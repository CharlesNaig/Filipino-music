/**
 * Shuffle Command
 * 
 * Shuffle the current queue.
 */

import Command from '../../structures/Command.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';

export default class Shuffle extends Command {
    constructor(client, file) {
        super(client, {
            name: 'shuffle',
            description: {
                content: 'Shuffle the current queue',
                usage: 'shuffle',
                examples: ['shuffle'],
            },
            aliases: ['mix', 'randomize'],
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

        // Check if queue has tracks to shuffle
        if (player.queue.tracks.length < 2) {
            return ctx.sendMessage({
                content: `\`❌\` Need at least 2 tracks in the queue to shuffle!`,
            });
        }

        try {
            // Shuffle the queue
            await player.queue.shuffle();

            // Save player state
            await savePlayerState(player, this.client);

            return ctx.sendMessage({
                content: `\`🔀\` Shuffled **${player.queue.tracks.length}** tracks in the queue!`,
            });
        } catch (error) {
            this.client.logger.error(`[Shuffle] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to shuffle: ${error.message}`,
            });
        }
    }
}
