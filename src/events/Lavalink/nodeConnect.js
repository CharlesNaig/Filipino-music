/**
 * Node Connect Event
 * 
 * Fires when a Lavalink node connects.
 */

import Event from '../../structures/Event.js';

export default class NodeConnect extends Event {
    constructor(...args) {
        super(...args, {
            name: 'nodeConnect',
        });
    }
    
    /**
     * @param {Object} node - Lavalink node
     */
    async run(node) {
        this.client.logger.success(`[${this.client.botName}] Lavalink node ${node.id} connected`);
        
        // Update bot status with lavalink connection
        try {
            await this.client.updateStatus('Available', {
                lavalinkConnected: true,
                connectedNodeId: node.id,
            });
        } catch (error) {
            this.client.logger.error(`[${this.client.botName}] Failed to update node status: ${error.message}`);
        }
    }
}
