/**
 * Player Error Event
 * 
 * Fires when a player encounters an error during playback.
 */

import Event from '../../structures/Event.js';

export default class PlayerError extends Event {
    constructor(...args) {
        super(...args, {
            name: 'trackError',
        });
    }
    
    /**
     * @param {Object} player - Lavalink player
     * @param {Object} track - Track that caused the error
     * @param {Object} payload - Error payload
     */
    async run(player, track, payload) {
        const guild = this.client.guilds.cache.get(player.guildId);
        if (!guild) return;
        
        const textChannel = guild.channels.cache.get(player.textChannelId);
        
        this.client.logger.error(`[${this.client.botName}] Player error in ${guild.name}: ${payload?.message || 'Unknown error'}`);
        
        if (textChannel) {
            try {
                await textChannel.send({
                    content: `\`❌\` Error playing **${track?.info?.title || 'Unknown track'}**: ${payload?.message || 'An unexpected error occurred'}. Skipping to next track...`,
                });
            } catch (error) {
                // Ignore message errors
            }
        }
        
        // Skip to next track
        try {
            if (player.queue.tracks.length > 0) {
                await player.skip();
            } else {
                // No more tracks, trigger queue end behavior
                const queueEndEvent = this.client.events.get('queueEnd');
                if (queueEndEvent) {
                    await queueEndEvent.run(player);
                }
            }
        } catch (error) {
            this.client.logger.error(`[${this.client.botName}] Failed to skip after error: ${error.message}`);
        }
    }
}
