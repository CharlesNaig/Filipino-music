/**
 * Node Disconnect Event
 * 
 * Fires when a Lavalink node disconnects.
 * Handles player migration to other nodes if available.
 */

import Event from '../../structures/Event.js';

export default class NodeDisconnect extends Event {
    constructor(...args) {
        super(...args, {
            name: 'nodeDisconnect',
        });
    }
    
    /**
     * @param {Object} node - Lavalink node
     * @param {string} reason - Disconnect reason
     */
    async run(node, reason) {
        this.client.logger.warn(`[${this.client.botName}] Lavalink node ${node.id} disconnected: ${reason || 'Unknown reason'}`);
        
        // Check if any other nodes are available
        const connectedNodes = this.client.lavalink?.nodeManager?.nodes?.filter(n => n.connected) || [];
        const hasActiveNodes = connectedNodes.size > 0;
        
        // Update bot status
        try {
            await this.client.updateStatus(hasActiveNodes ? 'Available' : 'Error', {
                lavalinkConnected: hasActiveNodes,
                connectedNodeId: hasActiveNodes ? connectedNodes.first()?.id : null,
                errorMessage: hasActiveNodes ? null : `Lavalink node ${node.id} disconnected`,
            });
        } catch (error) {
            this.client.logger.error(`[${this.client.botName}] Failed to update node status: ${error.message}`);
        }
        
        // If no nodes available, notify active players
        if (!hasActiveNodes) {
            for (const [guildId, player] of this.client.lavalink.players) {
                try {
                    const guild = this.client.guilds.cache.get(guildId);
                    if (!guild) continue;
                    
                    const textChannel = guild.channels.cache.get(player.textChannelId);
                    if (textChannel) {
                        await textChannel.send({
                            content: `\`⚠️\` Lost connection to the music server. Playback may be interrupted. Attempting to reconnect...`,
                        });
                    }
                } catch (error) {
                    // Ignore message errors
                }
            }
        }
    }
}
