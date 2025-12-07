/**
 * Clear Command
 * 
 * Clear the entire queue.
 */

import Command from '../../structures/Command.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';

export default class Clear extends Command {
    constructor(client, file) {
        super(client, {
            name: 'clear',
            description: {
                content: 'Clear the entire queue',
                usage: 'clear',
                examples: ['clear'],
            },
            aliases: ['empty', 'clearqueue', 'cq'],
            cooldown: 5,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [],
            category: 'music',
        });

        this.file = file;
    }

    async run(ctx, args) {
        // Check if user is in a voice channel
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                content: `\`❌\` You need to be in a voice channel!`,
            });
        }

        // Get player
        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player) {
            return ctx.sendMessage({
                content: `\`❌\` Nothing is playing right now!`,
            });
        }

        // Check if user is in the same voice channel
        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({
                content: `\`❌\` You need to be in the same voice channel as me!`,
            });
        }

        // Check if queue is empty
        if (player.queue.tracks.length === 0) {
            return ctx.sendMessage({
                content: `\`❌\` The queue is already empty!`,
            });
        }

        try {
            const clearedCount = player.queue.tracks.length;
            
            // Clear the queue
            player.queue.tracks = [];

            // Save player state
            await savePlayerState(player, this.client);

            return ctx.sendMessage({
                content: `\`🗑️\` Cleared **${clearedCount}** track${clearedCount !== 1 ? 's' : ''} from the queue!`,
            });
        } catch (error) {
            this.client.logger.error(`[Clear] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to clear queue: ${error.message}`,
            });
        }
    }
}
