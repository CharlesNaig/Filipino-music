/**
 * Skip Command
 * 
 * Skip the currently playing track.
 */

import Command from '../../structures/Command.js';

export default class Skip extends Command {
    constructor(client, file) {
        super(client, {
            name: 'skip',
            description: {
                content: 'Skip the current track',
                usage: 'skip',
                examples: ['skip'],
            },
            aliases: ['s', 'next'],
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

        // Check if there's a track playing
        if (!player.queue.current) {
            return ctx.sendMessage({
                content: `\`❌\` Nothing is playing right now!`,
            });
        }

        const currentTrack = player.queue.current;

        try {
            await player.skip();

            return ctx.sendMessage({
                content: `\`⏭️\` Skipped: **${currentTrack.info.title}**`,
            });
        } catch (error) {
            this.client.logger.error(`[Skip] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to skip: ${error.message}`,
            });
        }
    }
}
