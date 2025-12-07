import Event from "../../structures/Event.js";
import Context from "../../structures/Context.js";
import { Message, ChannelType, PermissionFlagsBits, Collection } from "discord.js";
import PrefixSchema from "../../schemas/prefix.js";
import GuildAssignment from "../../schemas/GuildAssignment.js";

async function getPrefix(guildId, client) {
    const data = await PrefixSchema.findOne({ _id: guildId });
    return data?.prefix || client.config.prefix;
}

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

// Music command categories/names for routing
const MUSIC_COMMANDS = [
    'play', 'p', 'skip', 's', 'stop', 'pause', 'resume', 'queue', 'q',
    'volume', 'vol', 'nowplaying', 'np', 'seek', 'shuffle', 'loop',
    '247', 'twentyfourseven', 'autoplay', 'previous', 'back', 'clear',
    'remove', 'move', 'jump', 'replay', 'filter', 'filters', 'bassboost',
    'nightcore', 'vaporwave', 'lyrics'
];

export default class MessageCreate extends Event {
    constructor(...args) {
        super(...args, {
            name: 'messageCreate'
        });
    }
    /**
     * @param {Message} message
     */
    async run(message) {
        if (message.author.bot || message.channel.type === ChannelType.DM) return;
        if (message.partial) await message.fetch();
        
        const ctx = new Context(message);
        const prefix = await getPrefix(message.guild.id, this.client);
        
        // Only main bot responds to mentions
        if (this.client.isMainBot) {
            const mention = new RegExp(`^<@!?${this.client.user.id}>( |)$`);
            if (message.content.match(mention)) {
                if (message.channel.permissionsFor(this.client.user).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ViewChannel])) {
                    return await message.reply({ content: `Hey, my prefix for this server is \`${prefix}\` Want more info? then do \`${prefix}help\`\nStay Safe, Stay Awesome!` }).catch(() => { });
                }
            }
        }

        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRegex = new RegExp(`^(<@!?${this.client.user.id}>|${escapeRegex(prefix)})\\s*`);
        if (!prefixRegex.test(message.content)) return;
        const [matchedPrefix] = message.content.match(prefixRegex);

        const args = message.content.slice(matchedPrefix.length).trim().split(/ +/g);
        const commandName = args.shift().toLowerCase();
        const command = this.client.commands.get(commandName) || this.client.commands.get(this.client.aliases.get(commandName));

        ctx.setArgs(args);

        if (!command) return;
        
        // Check if this bot should handle commands for this guild
        const isMusicCommand = MUSIC_COMMANDS.includes(commandName) || command.category === 'music';
        
        // Get user's voice channel for music command routing
        const userVoiceChannelId = message.member?.voice?.channelId || null;
        const shouldHandle = await shouldHandleCommand(this.client, message.guild.id, isMusicCommand, userVoiceChannelId);
        
        if (!shouldHandle) {
            // This bot should not respond - another bot is handling this guild
            return;
        }
        
        this.client.logger.cmd('%s used by %s from %s', commandName, ctx.author.id, ctx.guild.id);

        if (!message.inGuild() || !message.channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ViewChannel)) return;

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.SendMessages)) {
            return await message.author.send({ content: `I don't have **\`SEND_MESSAGES\`** permission in \`${message.guild.name}\`\nchannel: <#${message.channelId}>` }).catch(() => { });
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.EmbedLinks)) {
            return await message.channel.send({ content: 'I don\'t have **`EMBED_LINKS`** permission.' }).catch(() => { });
        }

        if (command.permissions) {
            if (command.permissions.client) {
                if (!message.guild.members.me.permissions.has(command.permissions.client)) {
                    return await message.reply({ content: 'I don\'t have enough permissions to execute this command.' });
                }
            }

            if (command.permissions.user) {
                if (!message.member.permissions.has(command.permissions.user)) {
                    return await message.reply({ content: 'You don\'t have enough permissions to use this command.' });
                }
            }
            
            if (command.permissions.dev) {
                if (this.client.config.ownerID) {
                    const findDev = this.client.config.ownerID.find((x) => x === message.author.id);
                    if (!findDev) return;
                }
            }
        }

        if (command.args) {
            if (!args.length) {
                return await message.reply({ content: `Please provide the required arguments.\nUsage: \`${prefix}${command.name} ${command.description.usage}\`` });
            }
        }
        
        if (!this.client.cooldowns.has(commandName)) {
            this.client.cooldowns.set(commandName, new Collection());
        }
        
        const now = Date.now();
        const timestamps = this.client.cooldowns.get(commandName);
        const cooldownAmount = Math.floor(command.cooldown || 5) * 1000;
        
        if (!timestamps.has(message.author.id)) {
            timestamps.set(message.author.id, now);
            setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        } else {
            const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
            const timeLeft = (expirationTime - now) / 1000;
            if (now < expirationTime && timeLeft > 0.9) {
                return message.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${commandName}\` command.` });
            }
            timestamps.set(message.author.id, now);
            setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        }
        
        try {
            return await command.run(ctx, ctx.args);
        } catch (error) {
            await message.channel.send({ content: 'An unexpected error occurred, the developers have been notified!' }).catch(() => { });
            console.error(error);
        }
    }
}