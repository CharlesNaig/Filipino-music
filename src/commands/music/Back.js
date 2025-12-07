/**
 * Back Command - Play the previous track
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class Back extends Command {
    constructor(client, file) {
        super(client, {
            name: 'back',
            description: {
                content: 'Play the previous track',
                usage: 'back',
                examples: ['back'],
            },
            aliases: ['previous', 'prev', 'b'],
            cooldown: 3,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx) {
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in a voice channel!` });
        }

        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Nothing is playing right now!` });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!` });
        }

        const previousTracks = player.queue.previous;
        if (!previousTracks || previousTracks.length === 0) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` No previous track to play!` });
        }

        const previousTrack = previousTracks[previousTracks.length - 1];
        
        // Add current track to front of queue
        if (player.queue.current) {
            player.queue.tracks.unshift(player.queue.current);
        }
        
        // Play previous track
        await player.play({ track: previousTrack });

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.previous} Previous Track\nNow playing: **${previousTrack.info.title}**`
            )
        );
        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
