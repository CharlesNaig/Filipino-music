/**
 * Queue End Event
 * 
 * Fires when the queue is empty and no more tracks to play.
 * Handles disconnect logic based on 24/7 mode.
 */

import Event from '../../structures/Event.js';
import PlayerSchema from '../../schemas/Player.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';

export default class QueueEnd extends Event {
    constructor(...args) {
        super(...args, {
            name: 'queueEnd',
        });
    }
    
    /**
     * @param {Object} player - Lavalink player
     */
    async run(player) {
        const guild = this.client.guilds.cache.get(player.guildId);
        if (!guild) return;
        
        const textChannel = guild.channels.cache.get(player.textChannelId);
        
        this.client.logger.info(`[${this.client.botName}] Queue ended in ${guild.name}`);
        
        // Check if 24/7 mode is enabled
        const is247 = player.get('twentyFourSeven');
        
        // Delete the now playing message
        const messageId = player.get('nowPlayingMessageId');
        if (messageId && textChannel) {
            try {
                const message = await textChannel.messages.fetch(messageId);
                if (message) {
                    await message.delete();
                }
            } catch (error) {
                // Message already deleted or not found
            }
            player.set('nowPlayingMessageId', null);
        }
        
        if (is247) {
            // 24/7 mode - stay in channel
            if (textChannel) {
                try {
                    await textChannel.send({
                        content: `\`📜\` Queue finished! I'll stay in the voice channel (24/7 mode). Add more tracks to continue!`,
                    });
                } catch (error) {
                    // Ignore message errors
                }
            }
            
            // Save state with empty queue
            try {
                await PlayerSchema.saveState(player.guildId, {
                    botId: this.client.botId,
                    voiceChannelId: player.voiceChannelId,
                    textChannelId: player.textChannelId,
                    volume: player.volume,
                    loopMode: player.repeatMode || 'off',
                    paused: false,
                    twentyFourSeven: true,
                    currentTrack: null,
                    queue: [],
                    destroyed: false,
                });
            } catch (error) {
                this.client.logger.error(`[${this.client.botName}] Failed to save 24/7 state: ${error.message}`);
            }
        } else {
            // Not 24/7 - schedule disconnect
            const disconnectTimeout = setTimeout(async () => {
                // Check if still no tracks
                const currentPlayer = this.client.lavalink?.players?.get(player.guildId);
                if (currentPlayer && currentPlayer.queue.tracks.length === 0 && !currentPlayer.queue.current) {
                    try {
                        if (textChannel) {
                            await textChannel.send({
                                content: `\`👋\` Queue finished! Disconnecting from the voice channel. Thanks for listening!`,
                            });
                        }
                    } catch (error) {
                        // Ignore message errors
                    }
                    
                    // Destroy player
                    await currentPlayer.destroy();
                    
                    // Mark player as destroyed in database
                    await PlayerSchema.markDestroyed(player.guildId);
                    
                    // Deactivate assignment
                    const assignment = await GuildAssignment.findById(player.guildId);
                    if (assignment) {
                        await assignment.deactivate();
                    }
                    
                    this.client.logger.info(`[${this.client.botName}] Player destroyed after queue end in ${guild.name}`);
                }
            }, 30000); // 30 seconds timeout
            
            // Store timeout reference
            player.set('queueEndTimeout', disconnectTimeout);
            
            // Send temporary message
            if (textChannel) {
                try {
                    await textChannel.send({
                        content: `\`📜\` Queue finished! Add more tracks within 30 seconds or I'll disconnect.`,
                    });
                } catch (error) {
                    // Ignore message errors
                }
            }
        }
    }
}
