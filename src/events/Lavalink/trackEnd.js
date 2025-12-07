/**
 * Track End Event
 * 
 * Fires when a track finishes playing.
 * Handles cleanup, queue progression, and user stats tracking.
 */

import Event from '../../structures/Event.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';
import UserStats from '../../schemas/UserStats.js';

export default class TrackEnd extends Event {
    constructor(...args) {
        super(...args, {
            name: 'trackEnd',
        });
    }
    
    /**
     * @param {Object} player - Lavalink player
     * @param {Object} track - Track that ended
     * @param {string} reason - Reason for track ending
     */
    async run(player, track, reason) {
        if (!track) return;
        
        const guild = this.client.guilds.cache.get(player.guildId);
        if (!guild) return;
        
        this.client.logger.debug(`[${this.client.botName}] Track ended: ${track.info.title} (${reason})`);
        
        // Track user listening stats
        await this._trackUserStats(player, track, guild);
        
        // Save player state after track ends
        await savePlayerState(player, this.client);
        
        // Delete the now playing message if track finished normally
        if (reason === 'finished' || reason === 'loadFailed') {
            const messageId = player.get('nowPlayingMessageId');
            if (messageId) {
                try {
                    const textChannel = guild.channels.cache.get(player.textChannelId);
                    if (textChannel) {
                        const message = await textChannel.messages.fetch(messageId);
                        if (message) {
                            await message.delete();
                        }
                    }
                } catch (error) {
                    // Message already deleted or not found
                }
                player.set('nowPlayingMessageId', null);
            }
        }
    }

    /**
     * Track user listening statistics
     * @private
     */
    async _trackUserStats(player, track, guild) {
        try {
            // Get the voice channel to find listeners
            const voiceChannel = guild.channels.cache.get(player.voiceChannelId);
            if (!voiceChannel) return;

            // Get all members in the voice channel (excluding bots)
            const members = voiceChannel.members.filter(m => !m.user.bot);
            if (members.size === 0) return;

            // Calculate listen duration (use track duration or position if skipped)
            const listenDuration = Math.min(
                player.position || track.info.duration,
                track.info.duration
            );

            // Track info for stats
            const trackInfo = {
                title: track.info.title,
                author: track.info.author,
                uri: track.info.uri
            };

            // Update stats for each listener
            const memberArray = Array.from(members.values());
            
            for (const member of memberArray) {
                try {
                    const userStats = await UserStats.getOrCreate(member.user.id);
                    
                    // Add track listen time
                    await userStats.addTrackTime(trackInfo, listenDuration);
                    
                    // Track friends (other users in the same voice channel)
                    for (const otherMember of memberArray) {
                        if (otherMember.user.id !== member.user.id) {
                            await userStats.addFriendTime(
                                otherMember.user.id,
                                otherMember.user.username,
                                listenDuration
                            );
                        }
                    }
                } catch (error) {
                    this.client.logger.error(`[TrackEnd] Failed to update stats for ${member.user.id}: ${error.message}`);
                }
            }

            this.client.logger.debug(`[${this.client.botName}] Updated stats for ${members.size} listeners`);
        } catch (error) {
            this.client.logger.error(`[TrackEnd] Stats tracking error: ${error.message}`);
        }
    }
}
