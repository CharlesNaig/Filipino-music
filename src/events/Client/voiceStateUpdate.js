/**
 * Voice State Update Event
 * 
 * Handles voice state changes for proper player management:
 * - Bot being disconnected from voice
 * - Bot being moved to different voice channel
 * - All members leaving the voice channel
 * - Bot being server-deafened/muted
 */

import Event from '../../structures/Event.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';
import PlayerSchema from '../../schemas/Player.js';

export default class VoiceStateUpdate extends Event {
    constructor(...args) {
        super(...args, {
            name: 'voiceStateUpdate',
        });
    }
    
    /**
     * @param {import('discord.js').VoiceState} oldState
     * @param {import('discord.js').VoiceState} newState
     */
    async run(oldState, newState) {
        const player = this.client.lavalink?.players?.get(newState.guild.id);
        
        // Handle bot's own voice state changes
        if (newState.member?.id === this.client.user.id) {
            await this._handleBotVoiceChange(oldState, newState, player);
            return;
        }
        
        // Handle member leaving the voice channel
        if (player && oldState.channelId && !newState.channelId) {
            await this._handleMemberLeave(oldState, player);
        }
    }
    
    /**
     * Handle when the bot's voice state changes
     * @private
     */
    async _handleBotVoiceChange(oldState, newState, player) {
        // Bot was disconnected from voice
        if (oldState.channelId && !newState.channelId) {
            this.client.logger.info(`[${this.client.botName}] Disconnected from voice in ${newState.guild.name}`);
            
            if (player) {
                // Check if 24/7 mode is enabled
                const is247 = player.get('twentyFourSeven');
                
                if (is247) {
                    // Attempt to reconnect
                    try {
                        await player.connect();
                        this.client.logger.info(`[${this.client.botName}] Reconnected to voice (24/7 mode)`);
                    } catch (error) {
                        // Failed to reconnect, destroy player
                        await this._destroyPlayer(player, newState.guild.id);
                    }
                } else {
                    // Not 24/7, destroy player
                    await this._destroyPlayer(player, newState.guild.id);
                }
            }
            
            // Deactivate assignment
            await this._deactivateAssignment(newState.guild.id);
            return;
        }
        
        // Bot was moved to a different channel
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            this.client.logger.info(`[${this.client.botName}] Moved to ${newState.channel.name} in ${newState.guild.name}`);
            
            if (player) {
                // Update player's voice channel
                player.voiceChannelId = newState.channelId;
                
                // Update assignment
                const assignment = await GuildAssignment.findById(newState.guild.id);
                if (assignment) {
                    assignment.voiceChannelId = newState.channelId;
                    await assignment.save();
                }
            }
            return;
        }
        
        // Bot joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            this.client.logger.info(`[${this.client.botName}] Joined ${newState.channel.name} in ${newState.guild.name}`);
            
            // Update assignment
            const assignment = await GuildAssignment.findById(newState.guild.id);
            if (assignment) {
                await assignment.activate(newState.channelId, assignment.textChannelId);
            }
        }
    }
    
    /**
     * Handle when a member leaves the voice channel
     * @private
     */
    async _handleMemberLeave(oldState, player) {
        // Check if bot is still in the channel
        if (player.voiceChannelId !== oldState.channelId) return;
        
        const voiceChannel = oldState.guild.channels.cache.get(player.voiceChannelId);
        if (!voiceChannel) return;
        
        // Get members in the voice channel (excluding bots)
        const members = voiceChannel.members.filter(m => !m.user.bot);
        
        // If no human members left
        if (members.size === 0) {
            const is247 = player.get('twentyFourSeven');
            
            if (is247) {
                // 24/7 mode - stay in channel but pause
                if (player.playing && !player.paused) {
                    await player.pause();
                    
                    // Send notification
                    try {
                        const textChannel = oldState.guild.channels.cache.get(player.textChannelId);
                        if (textChannel) {
                            await textChannel.send({
                                content: `\`⏸️\` Paused playback - no one left in the voice channel. I'll stay here in 24/7 mode!`,
                            });
                        }
                    } catch (error) {
                        // Ignore message errors
                    }
                }
            } else {
                // Not 24/7 - start disconnect timer
                const timeout = setTimeout(async () => {
                    // Re-check if still alone
                    const currentChannel = oldState.guild.channels.cache.get(player.voiceChannelId);
                    if (currentChannel) {
                        const currentMembers = currentChannel.members.filter(m => !m.user.bot);
                        
                        if (currentMembers.size === 0) {
                            // Still alone, disconnect
                            try {
                                const textChannel = oldState.guild.channels.cache.get(player.textChannelId);
                                if (textChannel) {
                                    await textChannel.send({
                                        content: `\`👋\` Left the voice channel due to inactivity. Use the play command to start again!`,
                                    });
                                }
                            } catch (error) {
                                // Ignore message errors
                            }
                            
                            await this._destroyPlayer(player, oldState.guild.id);
                        }
                    }
                }, 30000); // 30 seconds timeout
                
                // Store timeout reference for cancellation
                player.set('disconnectTimeout', timeout);
            }
        } else {
            // Someone is still in the channel, cancel any pending disconnect
            const existingTimeout = player.get('disconnectTimeout');
            if (existingTimeout) {
                clearTimeout(existingTimeout);
                player.set('disconnectTimeout', null);
            }
            
            // Resume if paused and members joined back
            if (player.paused && player.get('pausedDueToEmpty')) {
                await player.resume();
                player.set('pausedDueToEmpty', false);
            }
        }
    }
    
    /**
     * Destroy player and clean up
     * @private
     */
    async _destroyPlayer(player, guildId) {
        try {
            await player.destroy();
            await PlayerSchema.markDestroyed(guildId);
            this.client.logger.info(`[${this.client.botName}] Player destroyed for guild ${guildId}`);
        } catch (error) {
            this.client.logger.error(`[${this.client.botName}] Failed to destroy player: ${error.message}`);
        }
    }
    
    /**
     * Deactivate guild assignment
     * @private
     */
    async _deactivateAssignment(guildId) {
        try {
            const assignment = await GuildAssignment.findById(guildId);
            if (assignment) {
                await assignment.deactivate();
            }
        } catch (error) {
            this.client.logger.error(`[${this.client.botName}] Failed to deactivate assignment: ${error.message}`);
        }
    }
}
