/**
 * Track Stuck Event
 * 
 * Fires when a track gets stuck during playback.
 */

import Event from '../../structures/Event.js';

export default class TrackStuck extends Event {
    constructor(...args) {
        super(...args, {
            name: 'trackStuck',
        });
    }
    
    /**
     * @param {Object} player - Lavalink player
     * @param {Object} track - Track that got stuck
     * @param {Object} payload - Stuck payload
     */
    async run(player, track, payload) {
        const guild = this.client.guilds.cache.get(player.guildId);
        if (!guild) return;
        
        const textChannel = guild.channels.cache.get(player.textChannelId);
        
        this.client.logger.warn(`[${this.client.botName}] Track stuck in ${guild.name}: ${track?.info?.title}`);
        
        if (textChannel) {
            try {
                await textChannel.send({
                    content: `\`⚠️\` Track **${track?.info?.title || 'Unknown'}** got stuck. Skipping to the next track...`,
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
                // No more tracks, destroy player
                await player.destroy();
            }
        } catch (error) {
            this.client.logger.error(`[${this.client.botName}] Failed to skip stuck track: ${error.message}`);
        }
    }
}
