/**
 * Node Error Event
 * 
 * Fires when a Lavalink node encounters an error.
 */

import Event from '../../structures/Event.js';

export default class NodeError extends Event {
    constructor(...args) {
        super(...args, {
            name: 'nodeError',
        });
    }
    
    /**
     * @param {Object} node - Lavalink node
     * @param {Error} error - Error that occurred
     */
    async run(node, error) {
        this.client.logger.error(`[${this.client.botName}] Lavalink node ${node.id} error: ${error.message}`);
        
        // Update bot status with error
        try {
            await this.client.updateStatus('Error', {
                errorMessage: `Node ${node.id} error: ${error.message}`,
            });
        } catch (updateError) {
            this.client.logger.error(`[${this.client.botName}] Failed to update error status: ${updateError.message}`);
        }
    }
}
