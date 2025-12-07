/**
 * Track End Event
 * 
 * Fires when a track finishes playing.
 * Handles cleanup and queue progression.
 */

import Event from '../../structures/Event.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';

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
}
