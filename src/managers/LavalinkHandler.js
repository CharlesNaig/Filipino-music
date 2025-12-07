/**
 * Lavalink Handler Manager
 * 
 * Initializes and configures Lavalink for each bot instance.
 * Uses lavalink-client by tomato6966 for Lavalink v4 support.
 */

import { LavalinkManager } from 'lavalink-client';
import PlayerSchema from '../schemas/Player.js';

/**
 * Initialize Lavalink manager for a bot client
 * @param {import('../structures/Client.js').BotClient} client - Bot client instance
 * @param {Object} config - Full configuration object
 * @returns {Promise<LavalinkManager>}
 */
export async function initializeLavalink(client, config) {
    if (!config.lavalink || !config.lavalink.nodes || config.lavalink.nodes.length === 0) {
        client.logger.warn(`[${client.botName}] No Lavalink nodes configured`);
        return null;
    }
    
    // Build node configuration for lavalink-client
    const nodes = config.lavalink.nodes.map(node => ({
        id: node.id,
        host: node.host,
        port: node.port,
        authorization: node.authorization,
        secure: node.secure || false,
        retryAmount: node.retryAmount || 5,
        retryDelay: node.retryDelay || 3000,
    }));
    
    // Create LavalinkManager instance
    const lavalinkManager = new LavalinkManager({
        nodes,
        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                guild.shard.send(payload);
            }
        },
        autoSkip: true,
        client: {
            id: client.botConfig.clientId,
            username: client.user?.username || client.botName,
        },
        playerOptions: {
            defaultSearchPlatform: config.lavalink.defaultSearchPlatform || 'youtube',
            onDisconnect: {
                autoReconnect: true,
                destroyPlayer: false,
            },
            onEmptyQueue: {
                destroyAfterMs: config.lavalink.playerDefaults?.autoPlay ? -1 : 30000, // 30s timeout if no autoplay
                autoPlayFunction: config.lavalink.playerDefaults?.autoPlay ? autoPlayFunction : null,
            },
            volumeDecrementer: 0.75, // Reduces volume by 25% to prevent clipping
            requesterTransformer: requesterTransformer,
            onPlayerCreate: async (player) => {
                client.logger.debug(`[${client.botName}] Player created for guild ${player.guildId}`);
            },
            onPlayerDestroy: async (player) => {
                client.logger.debug(`[${client.botName}] Player destroyed for guild ${player.guildId}`);
                // Mark player as destroyed in database
                try {
                    await PlayerSchema.markDestroyed(player.guildId);
                } catch (error) {
                    client.logger.error(`Failed to mark player destroyed: ${error.message}`);
                }
            },
        },
        queueOptions: {
            maxPreviousTracks: 50,
        },
    });
    
    // Store reference to client on manager for event handlers
    lavalinkManager.client = client;
    
    // IMPORTANT: Add immediate error handlers to prevent unhandled errors
    // These prevent crashes while waiting for event files to load
    lavalinkManager.nodeManager.on('error', (node, error) => {
        client.logger.error(`[${client.botName}] Lavalink node ${node.id} error: ${error?.message || error}`);
    });
    
    lavalinkManager.nodeManager.on('disconnect', (node, reason) => {
        client.logger.warn(`[${client.botName}] Lavalink node ${node.id} disconnected: ${reason?.code || 'Unknown'}`);
    });
    
    lavalinkManager.nodeManager.on('reconnecting', (node) => {
        client.logger.info(`[${client.botName}] Lavalink node ${node.id} reconnecting...`);
    });
    
    // Add connect event to log when nodes actually connect
    lavalinkManager.nodeManager.on('connect', (node) => {
        client.logger.success(`[${client.botName}] Lavalink node ${node.id} connected!`);
    });
    
    // Initialize the manager - check if client is already ready
    const initManager = async () => {
        await lavalinkManager.init({
            id: client.user.id,
            username: client.user.username,
        });
        
        client.logger.ready(`[${client.botName}] Lavalink manager initialized`);
        
        // Resume players if enabled
        if (config.lavalink.resuming?.enabled) {
            await resumePlayers(client, lavalinkManager);
        }
    };
    
    // If client is already ready, initialize immediately
    // Otherwise wait for the ready event
    if (client.isReady()) {
        await initManager();
    } else {
        client.once('ready', initManager);
    }
    
    // Store lavalink manager on client
    client.lavalink = lavalinkManager;
    
    return lavalinkManager;
}

/**
 * Transform requester data for storage
 * @param {Object} requester - Discord user object
 * @returns {Object}
 */
function requesterTransformer(requester) {
    if (!requester) return null;
    
    return {
        id: requester.id,
        username: requester.username || requester.tag,
        discriminator: requester.discriminator || '0',
        avatar: requester.avatar,
        displayAvatarURL: typeof requester.displayAvatarURL === 'function' 
            ? requester.displayAvatarURL({ extension: 'png', size: 256 })
            : null,
    };
}

/**
 * Auto-play function for when queue ends
 * Finds similar tracks based on the last played track
 * @param {Object} player - Lavalink player
 * @param {Object} lastTrack - Last played track
 */
async function autoPlayFunction(player, lastTrack) {
    if (!lastTrack) return;
    
    try {
        // Search for similar tracks on YouTube Music
        const query = `${lastTrack.info.author} - ${lastTrack.info.title}`;
        const result = await player.search({ query, source: 'ytmsearch' }, lastTrack.requester);
        
        if (result.tracks.length > 0) {
            // Skip the first result if it's the same track
            const nextTrack = result.tracks.find(t => t.info.identifier !== lastTrack.info.identifier);
            
            if (nextTrack) {
                await player.queue.add(nextTrack);
            }
        }
    } catch (error) {
        // Silently fail autoplay
    }
}

/**
 * Resume players from database after restart
 * @param {BotClient} client - Bot client
 * @param {LavalinkManager} lavalink - Lavalink manager
 */
async function resumePlayers(client, lavalink) {
    try {
        // Find all players for this bot
        const savedPlayers = await PlayerSchema.findActiveByBot(client.botId);
        
        if (savedPlayers.length === 0) {
            client.logger.info(`[${client.botName}] No players to resume`);
            return;
        }
        
        client.logger.info(`[${client.botName}] Resuming ${savedPlayers.length} player(s)...`);
        
        for (const savedPlayer of savedPlayers) {
            try {
                const guild = client.guilds.cache.get(savedPlayer._id);
                if (!guild) continue;
                
                const voiceChannel = guild.channels.cache.get(savedPlayer.voiceChannelId);
                const textChannel = guild.channels.cache.get(savedPlayer.textChannelId);
                
                if (!voiceChannel || !textChannel) {
                    await PlayerSchema.markDestroyed(savedPlayer._id);
                    continue;
                }
                
                // Create player
                const player = await lavalink.createPlayer({
                    guildId: savedPlayer._id,
                    voiceChannelId: savedPlayer.voiceChannelId,
                    textChannelId: savedPlayer.textChannelId,
                    selfDeaf: true,
                    volume: savedPlayer.volume,
                });
                
                // Connect to voice
                await player.connect();
                
                // Restore settings
                player.setVolume(savedPlayer.volume);
                
                if (savedPlayer.loopMode !== 'off') {
                    player.setRepeatMode(savedPlayer.loopMode);
                }
                
                // Restore queue
                if (savedPlayer.currentTrack) {
                    // Re-search for the track
                    const result = await player.search({ 
                        query: savedPlayer.currentTrack.info?.uri || savedPlayer.currentTrack.info?.title 
                    });
                    
                    if (result.tracks.length > 0) {
                        await player.queue.add(result.tracks[0]);
                        
                        // Add remaining queue
                        for (const track of savedPlayer.queue) {
                            const trackResult = await player.search({ 
                                query: track.info?.uri || track.info?.title 
                            });
                            if (trackResult.tracks.length > 0) {
                                await player.queue.add(trackResult.tracks[0]);
                            }
                        }
                        
                        // Start playing
                        await player.play();
                        
                        // Seek to saved position
                        if (savedPlayer.position > 0) {
                            await player.seek(savedPlayer.position);
                        }
                        
                        // Apply pause state
                        if (savedPlayer.paused) {
                            await player.pause();
                        }
                        
                        client.logger.success(`[${client.botName}] Resumed player in ${guild.name}`);
                    }
                }
            } catch (error) {
                client.logger.error(`[${client.botName}] Failed to resume player: ${error.message}`);
                await PlayerSchema.markDestroyed(savedPlayer._id);
            }
        }
    } catch (error) {
        client.logger.error(`[${client.botName}] Error resuming players: ${error.message}`);
    }
}

/**
 * Save player state to database
 * @param {Object} player - Lavalink player
 * @param {BotClient} client - Bot client
 */
export async function savePlayerState(player, client) {
    try {
        const currentTrack = player.queue.current;
        const queueTracks = player.queue.tracks.map(t => ({
            info: t.info,
            requester: t.requester,
        }));
        
        await PlayerSchema.saveState(player.guildId, {
            botId: client.botId,
            voiceChannelId: player.voiceChannelId,
            textChannelId: player.textChannelId,
            volume: player.volume,
            loopMode: player.repeatMode || 'off',
            paused: player.paused,
            twentyFourSeven: player.get('twentyFourSeven') || false,
            autoPlay: player.get('autoPlay') || false,
            position: player.position,
            currentTrack: currentTrack ? {
                info: currentTrack.info,
                requester: currentTrack.requester,
            } : null,
            queue: queueTracks,
            nodeId: player.node?.id,
            destroyed: false,
        });
    } catch (error) {
        client.logger.error(`[${client.botName}] Failed to save player state: ${error.message}`);
    }
}

/**
 * Get player creation options
 * @param {Object} options - Player options
 * @param {Object} config - Configuration
 * @returns {Object}
 */
export function getPlayerOptions(options, config) {
    return {
        guildId: options.guildId,
        voiceChannelId: options.voiceChannelId,
        textChannelId: options.textChannelId,
        selfDeaf: config.lavalink?.playerDefaults?.selfDeaf ?? true,
        volume: config.lavalink?.playerDefaults?.volume ?? 80,
    };
}

/**
 * Format track duration to readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
export function formatDuration(ms) {
    if (!ms || ms === 0) return '0:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Create a progress bar for track position
 * @param {number} current - Current position
 * @param {number} total - Total duration
 * @param {number} size - Bar size in characters
 * @returns {string}
 */
export function createProgressBar(current, total, size = 15) {
    const percentage = current / total;
    const progress = Math.round(size * percentage);
    const empty = size - progress;
    
    const progressBar = '▓'.repeat(progress) + '░'.repeat(empty);
    return progressBar;
}
