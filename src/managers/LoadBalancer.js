/**
 * Load Balancer Manager
 * 
 * Handles bot assignment with priority logic:
 * 1. Main Bot (Bot 1) is always preferred if available
 * 2. Failover to other bots when Main Bot is at capacity or offline
 * 3. Round-robin fallback when all bots are busy
 */

import { Collection } from 'discord.js';
import BotStatus from '../schemas/BotStatus.js';
import GuildAssignment from '../schemas/GuildAssignment.js';

export default class LoadBalancer {
    /**
     * @param {Collection} botCluster - Collection of bot clients
     * @param {Object} options - Load balancing configuration
     */
    constructor(botCluster, options = {}) {
        this.botCluster = botCluster;
        this.options = {
            enabled: options.enabled !== false,
            strategy: options.strategy || 'priority',
            heartbeatInterval: options.heartbeatInterval || 30000,
            maxPlayersPerBot: options.maxPlayersPerBot || 100,
            staleThreshold: options.staleThreshold || 60000,
        };
        
        this.heartbeatTimer = null;
        this.logger = null;
        
        // Get logger from first bot
        const firstBot = botCluster.values().next().value;
        if (firstBot) {
            this.logger = firstBot.logger;
        }
    }
    
    /**
     * Initialize the load balancer
     */
    async initialize() {
        // Update initial status for all bots
        for (const [botId, client] of this.botCluster) {
            await this._updateBotStatus(client);
        }
        
        // Clean up stale assignments
        await GuildAssignment.releaseInactiveAssignments(this.options.staleThreshold);
        
        this._log('info', 'Load Balancer initialized');
    }
    
    /**
     * Start periodic heartbeat updates
     */
    startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        
        this.heartbeatTimer = setInterval(async () => {
            await this._heartbeat();
        }, this.options.heartbeatInterval);
        
        this._log('info', `Heartbeat started (interval: ${this.options.heartbeatInterval}ms)`);
    }
    
    /**
     * Stop heartbeat monitoring
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this._log('info', 'Heartbeat stopped');
    }
    
    /**
     * Perform heartbeat - update all bot statuses
     * @private
     */
    async _heartbeat() {
        for (const [botId, client] of this.botCluster) {
            await this._updateBotStatus(client);
        }
        
        // Mark stale bots as offline
        await BotStatus.markStaleBotsOffline(this.options.staleThreshold);
    }
    
    /**
     * Update bot status in database
     * @private
     */
    async _updateBotStatus(client) {
        try {
            const playerCount = client.lavalink?.players?.size || 0;
            client.playerCount = playerCount;
            
            let status = 'Available';
            if (!client.isReady()) {
                status = 'Offline';
            } else if (playerCount >= this.options.maxPlayersPerBot) {
                status = 'InUse';
            } else if (playerCount > 0) {
                status = 'InUse';
            }
            
            await client.updateStatus(status, {
                playerCount,
                guildCount: client.guilds.cache.size,
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                ping: client.ws.ping,
                uptime: client.uptime || 0,
                lavalinkConnected: !!client.lavalink?.nodeManager?.nodes?.size,
            });
        } catch (error) {
            this._log('error', `Failed to update status for ${client.botName}: ${error.message}`);
        }
    }
    
    /**
     * Assign a bot to handle a guild's music
     * @param {string} guildId - Guild ID
     * @returns {Promise<{botId: string, client: BotClient, assignment: GuildAssignment}|null>}
     */
    async assignBot(guildId) {
        // Check existing assignment first
        const existingAssignment = await GuildAssignment.findById(guildId);
        
        if (existingAssignment && existingAssignment.isActive) {
            const existingClient = this.botCluster.get(existingAssignment.assignedBotId);
            
            // Verify the bot is still available
            if (existingClient && existingClient.isReady()) {
                await existingAssignment.touch();
                return {
                    botId: existingAssignment.assignedBotId,
                    client: existingClient,
                    assignment: existingAssignment,
                };
            }
        }
        
        // Find available bot based on strategy
        const selectedBot = await this._selectBot();
        
        if (!selectedBot) {
            this._log('warn', `No available bots for guild ${guildId}`);
            return null;
        }
        
        // Create or update assignment
        const assignment = await GuildAssignment.getOrCreateAssignment(
            guildId,
            selectedBot.botId,
            selectedBot.client.botConfig.clientId,
            existingAssignment ? 'failover' : 'auto'
        );
        
        this._log('info', `Assigned ${selectedBot.client.botName} to guild ${guildId}`);
        
        return {
            botId: selectedBot.botId,
            client: selectedBot.client,
            assignment,
        };
    }
    
    /**
     * Select the best available bot based on strategy
     * @private
     */
    async _selectBot() {
        if (this.options.strategy === 'priority') {
            return this._selectByPriority();
        } else if (this.options.strategy === 'roundRobin') {
            return this._selectByRoundRobin();
        }
        
        return this._selectByPriority();
    }
    
    /**
     * Priority selection - Main Bot first, then failover
     * @private
     */
    async _selectByPriority() {
        // Sort bots: Main bot first, then by player count
        const sortedBots = [...this.botCluster.entries()]
            .filter(([, client]) => client.isReady())
            .sort((a, b) => {
                // Main bot has priority
                if (a[1].isMainBot && !b[1].isMainBot) return -1;
                if (!a[1].isMainBot && b[1].isMainBot) return 1;
                
                // Then by player count (lower is better)
                return (a[1].playerCount || 0) - (b[1].playerCount || 0);
            });
        
        for (const [botId, client] of sortedBots) {
            const playerCount = client.lavalink?.players?.size || 0;
            
            // Check if bot has capacity
            if (playerCount < this.options.maxPlayersPerBot) {
                return { botId, client };
            }
        }
        
        // No bot with capacity found - use least loaded
        if (sortedBots.length > 0) {
            const [botId, client] = sortedBots[0];
            return { botId, client };
        }
        
        return null;
    }
    
    /**
     * Round-robin selection for load distribution
     * @private
     */
    async _selectByRoundRobin() {
        const availableBots = [...this.botCluster.entries()]
            .filter(([, client]) => client.isReady())
            .sort((a, b) => (a[1].playerCount || 0) - (b[1].playerCount || 0));
        
        if (availableBots.length === 0) return null;
        
        const [botId, client] = availableBots[0];
        return { botId, client };
    }
    
    /**
     * Release bot assignment when player is destroyed
     * @param {string} guildId - Guild ID
     */
    async releaseBot(guildId) {
        try {
            const assignment = await GuildAssignment.findById(guildId);
            
            if (assignment) {
                await assignment.deactivate();
                this._log('info', `Released assignment for guild ${guildId}`);
            }
        } catch (error) {
            this._log('error', `Failed to release assignment: ${error.message}`);
        }
    }
    
    /**
     * Check if a specific bot is assigned to a guild
     * @param {string} guildId - Guild ID
     * @param {string} botId - Bot ID to check
     * @returns {Promise<boolean>}
     */
    async isAssignedToBot(guildId, botId) {
        const assignment = await GuildAssignment.findById(guildId);
        
        if (!assignment) return false;
        
        return assignment.assignedBotId === botId;
    }
    
    /**
     * Get the assigned bot for a guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<{botId: string, client: BotClient}|null>}
     */
    async getAssignedBot(guildId) {
        const assignment = await GuildAssignment.findById(guildId);
        
        if (!assignment) return null;
        
        const client = this.botCluster.get(assignment.assignedBotId);
        
        if (!client || !client.isReady()) return null;
        
        return {
            botId: assignment.assignedBotId,
            client,
            assignment,
        };
    }
    
    /**
     * Force assign a guild to a specific bot (admin command)
     * @param {string} guildId - Guild ID
     * @param {string} targetBotId - Target bot ID
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async forceAssign(guildId, targetBotId) {
        const targetClient = this.botCluster.get(targetBotId);
        
        if (!targetClient) {
            return { success: false, message: `Bot ${targetBotId} not found` };
        }
        
        if (!targetClient.isReady()) {
            return { success: false, message: `Bot ${targetBotId} is not ready` };
        }
        
        await GuildAssignment.reassignGuild(
            guildId,
            targetBotId,
            targetClient.botConfig.clientId,
            'manual'
        );
        
        return { success: true, message: `Guild assigned to ${targetClient.botName}` };
    }
    
    /**
     * Get cluster statistics
     * @returns {Promise<Object>}
     */
    async getClusterStats() {
        const stats = {
            totalBots: this.botCluster.size,
            onlineBots: 0,
            totalPlayers: 0,
            totalGuilds: 0,
            totalMemory: 0,
            bots: [],
        };
        
        for (const [botId, client] of this.botCluster) {
            const playerCount = client.lavalink?.players?.size || 0;
            const guildCount = client.guilds.cache.size;
            const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            
            const botStats = {
                id: botId,
                name: client.botName,
                isMain: client.isMainBot,
                online: client.isReady(),
                players: playerCount,
                guilds: guildCount,
                ping: client.ws.ping,
                uptime: client.uptime || 0,
                lavalinkConnected: !!client.lavalink?.nodeManager?.nodes?.size,
            };
            
            stats.bots.push(botStats);
            
            if (client.isReady()) stats.onlineBots++;
            stats.totalPlayers += playerCount;
            stats.totalGuilds += guildCount;
        }
        
        stats.totalMemory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        return stats;
    }
    
    /**
     * Helper logging function
     * @private
     */
    _log(level, message) {
        if (this.logger) {
            this.logger[level](`[LoadBalancer] ${message}`);
        } else {
            console[level](`[LoadBalancer] ${message}`);
        }
    }
}
