/**
 * Resume Command
 * 
 * Resume paused playback.
 */

import Command from '../../structures/Command.js';

export default class Resume extends Command {
    constructor(client, file) {
        super(client, {
            name: 'resume',
            description: {
                content: 'Resume paused playback',
                usage: 'resume',
                examples: ['resume'],
            },
            aliases: ['unpause', 'continue'],
            cooldown: 3,
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

        // Check if not paused
        if (!player.paused) {
            return ctx.sendMessage({
                content: `\`▶️\` Already playing!`,
            });
        }

        try {
            await player.resume();

            return ctx.sendMessage({
                content: `\`▶️\` Resumed playback!`,
            });
        } catch (error) {
            this.client.logger.error(`[Resume] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to resume: ${error.message}`,
            });
        }
    }
}
