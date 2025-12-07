import Event from "../../structures/Event.js";
import Context from "../../structures/Context.js";
import { InteractionType, Collection, PermissionFlagsBits, CommandInteraction } from "discord.js";
import GuildAssignment from "../../schemas/GuildAssignment.js";

// Music command names for routing
const MUSIC_COMMANDS = [
    'play', 'skip', 'stop', 'pause', 'resume', 'queue',
    'volume', 'nowplaying', 'seek', 'shuffle', 'loop',
    '247', 'autoplay', 'previous', 'clear', 'remove',
    'move', 'jump', 'replay', 'filter', 'lyrics'
];

/**
 * Check if this bot should handle a command for this guild
 * Uses global locking to prevent race conditions between bots
 * 
 * Routing Logic:
 * 1. Main Bot handles ALL commands by default
 * 2. For music commands: Check if this bot is busy in a DIFFERENT voice channel
 *    - If busy in different VC → don't handle (let another bot take it)
 * 3. Failover bots respond in PRIORITY ORDER (bot-2 before bot-3, etc.):
 *    - Only if Main Bot is busy AND this bot is the FIRST available failover
 * 
 * @param {import('../../structures/Client.js').BotClient} client - Current bot client
 * @param {string} guildId - Guild ID
 * @param {boolean} isMusicCommand - Whether this is a music command
 * @param {string|null} userVoiceChannelId - User's current voice channel ID
 * @returns {Promise<boolean>}
 */
async function shouldHandleCommand(client, guildId, isMusicCommand, userVoiceChannelId = null) {
    const orchestrator = global.orchestrator;
    
    // Main bot logic
    if (client.isMainBot) {
        // For music commands, check if we're busy in a different voice channel
        if (isMusicCommand && userVoiceChannelId) {
            const existingPlayer = client.lavalink?.players?.get(guildId);
            if (existingPlayer && existingPlayer.voiceChannelId) {
                // This bot has an active player - check if it's in the SAME voice channel
                if (existingPlayer.voiceChannelId !== userVoiceChannelId) {
                    // Bot is busy in a DIFFERENT voice channel - don't handle
                    // Let routing find another available bot
                    client.logger.debug(`[${client.botId}] Busy in VC ${existingPlayer.voiceChannelId}, user is in ${userVoiceChannelId} - deferring to failover`);
                    return false;
                }
            }
        }
        
        // Also check if guild is assigned to another bot for music commands
        if (isMusicCommand) {
            const assignment = await GuildAssignment.findById(guildId);
            if (assignment?.isActive && assignment.assignedBotId !== client.botId) {
                // Guild has active player on another bot - don't interfere
                return false;
            }
        }
        
        // Main bot handles - acquire lock if music command
        if (isMusicCommand && orchestrator?.acquireCommandLock) {
            orchestrator.acquireCommandLock(guildId, client.botId);
        }
        return true;
    }
    
    // ==========================================
    // FAILOVER BOT LOGIC
    // ==========================================
    
    // Failover bots ONLY handle MUSIC commands
    if (!isMusicCommand) {
        return false;
    }
    
    // Check if another bot already has the lock
    if (orchestrator?.hasCommandLock) {
        if (!orchestrator.hasCommandLock(guildId, client.botId)) {
            // Check if any bot has the lock
            const lockExists = orchestrator.acquireCommandLock(guildId, client.botId);
            if (!lockExists) {
                // Another bot got the lock first
                client.logger.debug(`[${client.botId}] Another bot has command lock for guild ${guildId} - skipping`);
                return false;
            }
            // We got the lock, but release it for now - we'll re-acquire if we should handle
            orchestrator.releaseCommandLock(guildId, client.botId);
        }
    }
    
    // For failover bots, check if already has a player in this guild
    if (userVoiceChannelId) {
        const existingPlayer = client.lavalink?.players?.get(guildId);
        if (existingPlayer && existingPlayer.voiceChannelId) {
            if (existingPlayer.voiceChannelId !== userVoiceChannelId) {
                // This failover bot is busy in a different VC - don't handle
                client.logger.debug(`[${client.botId}] Failover busy in VC ${existingPlayer.voiceChannelId}, user is in ${userVoiceChannelId} - skipping`);
                return false;
            }
            // This bot already has a player in the SAME VC - handle it
            if (orchestrator?.acquireCommandLock) {
                orchestrator.acquireCommandLock(guildId, client.botId);
            }
            return true;
        }
    }
    
    // Check assignment - if assigned to this bot, handle it
    const assignment = await GuildAssignment.findById(guildId);
    if (assignment?.isActive && assignment.assignedBotId === client.botId) {
        if (orchestrator?.acquireCommandLock) {
            orchestrator.acquireCommandLock(guildId, client.botId);
        }
        return true;
    }
    
    // Check if we should take over from Main Bot
    if (!orchestrator || !userVoiceChannelId) {
        return false;
    }
    
    // Find Main Bot and check if it's busy
    let mainBotClient = null;
    for (const [botId, botClient] of orchestrator.bots) {
        if (botClient.isMainBot) {
            mainBotClient = botClient;
            break;
        }
    }
    
    if (!mainBotClient?.lavalink) {
        return false;
    }
    
    const mainBotPlayer = mainBotClient.lavalink.players?.get(guildId);
    
    // Main Bot must be busy in a DIFFERENT VC for failover to activate
    if (!mainBotPlayer || !mainBotPlayer.voiceChannelId) {
        return false; // Main bot not busy, it should handle
    }
    
    if (mainBotPlayer.voiceChannelId === userVoiceChannelId) {
        return false; // Main bot is in the same VC, let it handle
    }
    
    // Main Bot IS busy in a different VC - check if THIS bot should be the one to respond
    // Priority: bot-2 first, then bot-3, then bot-4, etc.
    
    // Get all failover bots sorted by priority (bot-2, bot-3, ...)
    const failoverBots = [];
    for (const [botId, botClient] of orchestrator.bots) {
        if (!botClient.isMainBot) {
            failoverBots.push({ id: botId, client: botClient });
        }
    }
    
    // Sort by bot ID (bot-2 before bot-3, etc.)
    failoverBots.sort((a, b) => a.id.localeCompare(b.id));
    
    // Find the FIRST available failover bot
    for (const failover of failoverBots) {
        const failoverPlayer = failover.client.lavalink?.players?.get(guildId);
        
        // Check if this failover bot is available (no player OR player in same VC)
        const isAvailable = !failoverPlayer || 
            !failoverPlayer.voiceChannelId || 
            failoverPlayer.voiceChannelId === userVoiceChannelId;
        
        if (isAvailable) {
            // This is the first available failover bot
            if (failover.client.botId === client.botId) {
                // It's THIS bot! Try to acquire the lock
                if (orchestrator.acquireCommandLock) {
                    const gotLock = orchestrator.acquireCommandLock(guildId, client.botId);
                    if (!gotLock) {
                        client.logger.debug(`[${client.botId}] Failed to acquire lock for guild ${guildId} - another bot got it`);
                        return false;
                    }
                }
                client.logger.info(`[${client.botId}] First available failover - Main Bot busy, taking over`);
                return true;
            } else {
                // Another failover bot has higher priority - don't handle
                client.logger.debug(`[${client.botId}] Higher priority failover ${failover.id} is available - skipping`);
                return false;
            }
        }
    }
    
    // No available failover bots (shouldn't happen, but safety check)
    return false;
}

export default class InteractionCreate extends Event {
    constructor(...args) {
        super(...args, {
            name: 'interactionCreate'
        });
    }
    /**
     * 
     * @param {CommandInteraction} interaction
     */
    async run(interaction) {
        if (interaction.type === InteractionType.ApplicationCommand) {
            const { commandName } = interaction;
            if (!commandName) return await interaction.reply({ content: 'Unknown interaction!' }).catch(() => { });
            
            const cmd = this.client.commands.get(interaction.commandName);
            if (!cmd || !cmd.slashCommand) return;
            
            const command = cmd.name.toLowerCase();
            const ctx = new Context(interaction, interaction.options.data);
            
            // Check if this bot should handle commands for this guild
            const isMusicCommand = MUSIC_COMMANDS.includes(command) || cmd.category === 'music';
            
            if (interaction.guildId) {
                // Get user's voice channel for music command routing
                const userVoiceChannelId = interaction.member?.voice?.channelId || null;
                const shouldHandle = await shouldHandleCommand(this.client, interaction.guildId, isMusicCommand, userVoiceChannelId);
                
                if (!shouldHandle) {
                    // This bot should not respond - let main bot or assigned bot handle it
                    return;
                }
            }
            
            this.client.logger.cmd('%s used by %s from %s', command, ctx.author.id, ctx.guild?.id || 'DM');
            
            if (!interaction.inGuild() || !interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ViewChannel)) {
                return await interaction.reply({ content: 'I cannot see this channel!', ephemeral: true }).catch(() => { });
            }

            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.SendMessages)) {
                return await interaction.author.send({ content: `I don't have **\`SEND_MESSAGES\`** permission in \`${interaction.guild.name}\`\nchannel: <#${interaction.channelId}>` }).catch(() => { });
            }

            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.EmbedLinks)) {
                return await interaction.reply({ content: 'I don\'t have **`EMBED_LINKS`** permission.', ephemeral: true }).catch(() => { });
            }

            // Check permissions
            if (cmd.permissions) {
                if (cmd.permissions.client) {
                    if (!interaction.guild.members.me.permissions.has(cmd.permissions.client)) {
                        return await interaction.reply({ content: 'I don\'t have enough permissions to execute this command.', ephemeral: true }).catch(() => { });
                    }
                }

                if (cmd.permissions.user) {
                    if (!interaction.member.permissions.has(cmd.permissions.user)) {
                        return await interaction.reply({ content: 'You don\'t have enough permissions to execute this command.', ephemeral: true }).catch(() => { });
                    }
                }
                
                if (cmd.permissions.dev) {
                    if (this.client.config.ownerID) {
                        const findDev = this.client.config.ownerID.find((x) => x === interaction.user.id);
                        if (!findDev) {
                            return await interaction.reply({ content: 'This command is only for developers.', ephemeral: true }).catch(() => { });
                        }
                    }
                }
            }

            // Cooldown handling
            if (!this.client.cooldowns.has(commandName)) {
                this.client.cooldowns.set(commandName, new Collection());
            }
            
            const now = Date.now();
            const timestamps = this.client.cooldowns.get(commandName);
            const cooldownAmount = Math.floor(cmd.cooldown || 5) * 1000;
            
            if (!timestamps.has(interaction.user.id)) {
                timestamps.set(interaction.user.id, now);
                setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
            } else {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
                const timeLeft = (expirationTime - now) / 1000;
                if (now < expirationTime && timeLeft > 0.9) {
                    return interaction.reply({ 
                        content: `Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${commandName}\` command.`,
                        ephemeral: true
                    });
                }
                timestamps.set(interaction.user.id, now);
                setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
            }
            
            try {
                return await cmd.run(ctx, ctx.args);
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    ephemeral: true,
                    content: 'An unexpected error occurred, the developers have been notified.',
                }).catch(() => { });
            }
        }
    }
}