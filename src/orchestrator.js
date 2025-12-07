/**
 * Orchestrator - Multi-Bot Cluster Manager
 * 
 * This is the main entry point for running multiple bot instances
 * in a single Node.js process. It manages the lifecycle of all bots,
 * initializes shared resources, and coordinates the load balancer.
 * 
 * Usage: node src/orchestrator.js
 */

import { Collection } from 'discord.js';
import { config } from './config.js';
import { BotClient } from './structures/Client.js';
import Logger from './structures/Logger.js';
import { initializeLavalink } from './managers/LavalinkHandler.js';
import LoadBalancer from './managers/LoadBalancer.js';

// Main logger for orchestrator
const logger = new Logger({
    displayTimestamp: true,
    displayDate: true,
});
logger.scope = 'Orchestrator';

/**
 * Bot Cluster - Collection of all bot instances
 * @type {Collection<string, BotClient>}
 */
export const botCluster = new Collection();

/**
 * Load Balancer instance
 * @type {LoadBalancer}
 */
export let loadBalancer = null;

/**
 * Command Locks - Prevents race conditions for guild commands
 * Map<guildId, { botId: string, timestamp: number }>
 * @type {Map<string, { botId: string, timestamp: number }>}
 */
const commandLocks = new Map();

/**
 * Lock timeout in milliseconds (auto-release if not released)
 */
const LOCK_TIMEOUT = 10000; // 10 seconds

/**
 * Acquire a lock for handling a command in a guild
 * Returns true if lock acquired, false if another bot has the lock
 * @param {string} guildId 
 * @param {string} botId 
 * @returns {boolean}
 */
function acquireCommandLock(guildId, botId) {
    const existing = commandLocks.get(guildId);
    const now = Date.now();
    
    // Check if there's an existing lock
    if (existing) {
        // If lock is expired, remove it
        if (now - existing.timestamp > LOCK_TIMEOUT) {
            commandLocks.delete(guildId);
        } else if (existing.botId !== botId) {
            // Another bot has the lock and it's not expired
            return false;
        } else {
            // This bot already has the lock
            return true;
        }
    }
    
    // Acquire the lock
    commandLocks.set(guildId, { botId, timestamp: now });
    return true;
}

/**
 * Release a command lock for a guild
 * @param {string} guildId 
 * @param {string} botId 
 */
function releaseCommandLock(guildId, botId) {
    const existing = commandLocks.get(guildId);
    if (existing && existing.botId === botId) {
        commandLocks.delete(guildId);
    }
}

/**
 * Check if a bot has the lock for a guild
 * @param {string} guildId 
 * @param {string} botId 
 * @returns {boolean}
 */
function hasCommandLock(guildId, botId) {
    const existing = commandLocks.get(guildId);
    if (!existing) return false;
    
    // Check if expired
    if (Date.now() - existing.timestamp > LOCK_TIMEOUT) {
        commandLocks.delete(guildId);
        return false;
    }
    
    return existing.botId === botId;
}

/**
 * Global orchestrator reference for cross-bot communication
 * Used by event handlers to check other bots' status
 */
global.orchestrator = {
    bots: botCluster,
    getLoadBalancer: () => loadBalancer,
    acquireCommandLock,
    releaseCommandLock,
    hasCommandLock,
};

/**
 * MongoDB connection status
 * @type {boolean}
 */
let mongoConnected = false;

/**
 * Initialize MongoDB connection (shared across all bots)
 */
async function initializeMongoDB() {
    if (!config.mongourl) {
        logger.warn('MongoDB URL not configured, skipping database connection');
        return false;
    }
    
    try {
        const mongoose = await import('mongoose');
        mongoose.default.set('strictQuery', true);
        await mongoose.default.connect(config.mongourl);
        mongoConnected = true;
        logger.ready('Connected to MongoDB (shared connection)');
        return true;
    } catch (error) {
        logger.error(`Failed to connect to MongoDB: ${error.message}`);
        return false;
    }
}

/**
 * Initialize a single bot instance
 * @param {Object} botConfig - Bot configuration
 * @returns {Promise<BotClient|null>}
 */
async function initializeBot(botConfig) {
    if (!botConfig.token || !botConfig.clientId) {
        logger.warn(`Skipping bot ${botConfig.id}: Missing token or clientId`);
        return null;
    }
    
    try {
        logger.info(`Initializing ${botConfig.name} (${botConfig.id})...`);
        
        // Create bot client
        const client = new BotClient(botConfig);
        
        // Start the bot (login, load events/commands)
        await client.start();
        
        // Store in cluster
        botCluster.set(botConfig.id, client);
        
        logger.success(`${botConfig.name} is ready!`);
        return client;
    } catch (error) {
        logger.error(`Failed to initialize ${botConfig.name}: ${error.message}`);
        return null;
    }
}

/**
 * Initialize Lavalink for all bots
 */
async function initializeLavalinkForCluster() {
    if (!config.lavalink.nodes || config.lavalink.nodes.length === 0) {
        logger.warn('No Lavalink nodes configured, music features disabled');
        return;
    }
    
    for (const [botId, client] of botCluster) {
        try {
            await initializeLavalink(client, config);
            
            // Load Lavalink events after initialization
            await client.loadLavalinkEvents();
            
            logger.success(`Lavalink initialized for ${client.botName}`);
        } catch (error) {
            logger.error(`Failed to initialize Lavalink for ${client.botName}: ${error.message}`);
        }
    }
}

/**
 * Initialize the Load Balancer
 */
async function initializeLoadBalancer() {
    try {
        loadBalancer = new LoadBalancer(botCluster, config.loadBalancing);
        await loadBalancer.initialize();
        
        // Start heartbeat monitoring
        loadBalancer.startHeartbeat();
        
        logger.success('Load Balancer initialized');
    } catch (error) {
        logger.error(`Failed to initialize Load Balancer: ${error.message}`);
    }
}

/**
 * Start the bot cluster
 */
async function startCluster() {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('      Multi-Bot Cluster - Starting Up');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validate bot configurations
    if (!config.bots || config.bots.length === 0) {
        logger.error('No bots configured! Check your .env file');
        process.exit(1);
    }
    
    logger.info(`Found ${config.bots.length} bot(s) to initialize`);
    
    // Connect to MongoDB first (shared connection)
    await initializeMongoDB();
    
    // Initialize all bots
    const initPromises = config.bots.map(botConfig => initializeBot(botConfig));
    const results = await Promise.allSettled(initPromises);
    
    // Count successful initializations
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    
    if (successCount === 0) {
        logger.error('No bots were successfully initialized!');
        process.exit(1);
    }
    
    logger.info(`Successfully initialized ${successCount}/${config.bots.length} bot(s)`);
    
    // Initialize Lavalink for all bots
    await initializeLavalinkForCluster();
    
    // Initialize Load Balancer
    await initializeLoadBalancer();
    
    // Print cluster status
    printClusterStatus();
    
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.ready('Cluster is fully operational!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Print current cluster status
 */
function printClusterStatus() {
    logger.info('');
    logger.info('┌─────────────────────────────────────────────┐');
    logger.info('│              Cluster Status                 │');
    logger.info('├─────────────────────────────────────────────┤');
    
    for (const [botId, client] of botCluster) {
        const status = client.isReady() ? '🟢 Online' : '🔴 Offline';
        const main = client.isMainBot ? ' (Main)' : '';
        const guilds = client.guilds.cache.size;
        const lavalink = client.lavalink ? '✓' : '✗';
        
        logger.info(`│ ${client.botName}${main}`);
        logger.info(`│   Status: ${status}`);
        logger.info(`│   Guilds: ${guilds} | Lavalink: ${lavalink}`);
        logger.info('├─────────────────────────────────────────────┤');
    }
    
    logger.info('└─────────────────────────────────────────────┘');
    logger.info('');
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
    logger.warn(`Received ${signal}, initiating graceful shutdown...`);
    
    // Stop heartbeat
    if (loadBalancer) {
        loadBalancer.stopHeartbeat();
    }
    
    // Shutdown all bots
    const shutdownPromises = [];
    for (const [botId, client] of botCluster) {
        shutdownPromises.push(client.shutdown());
    }
    
    await Promise.allSettled(shutdownPromises);
    
    // Close MongoDB connection
    if (mongoConnected) {
        try {
            const mongoose = await import('mongoose');
            await mongoose.default.disconnect();
            logger.info('MongoDB connection closed');
        } catch (error) {
            logger.error(`Error closing MongoDB: ${error.message}`);
        }
    }
    
    logger.info('Cluster shutdown complete');
    process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}`);
    logger.error(`Reason: ${reason}`);
});

// Start the cluster
startCluster().catch((error) => {
    logger.error(`Fatal error starting cluster: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
});
