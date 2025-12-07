/**
 * NowPlaying Command
 * 
 * Display the currently playing track.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } from 'discord.js';
import { formatDuration, createProgressBar } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class NowPlaying extends Command {
    constructor(client, file) {
        super(client, {
            name: 'nowplaying',
            description: {
                content: 'Display the currently playing track',
                usage: 'nowplaying',
                examples: ['nowplaying'],
            },
            aliases: ['np', 'current', 'playing'],
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
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You need to be in a voice channel!`,
            });
        }

        // Get player
        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` Nothing is playing right now!`,
            });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!`,
            });
        }

        const track = player.queue.current;
        const position = player.position;
        const duration = track.info.duration;

        const container = new ContainerBuilder();

        // Header with thumbnail
        const headerSection = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${player.paused ? `${emojis.player.pause} Paused` : `${emojis.player.music} Now Playing`}\n` +
                    `**[${track.info.title}](${track.info.uri})**`
                )
            );

        if (track.info.artworkUrl || track.info.thumbnail) {
            headerSection.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(track.info.artworkUrl || track.info.thumbnail)
            );
        }

        container.addSectionComponents(headerSection);
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Artist info
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${emojis.misc.user} **Artist:** ${track.info.author || 'Unknown'}`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Duration/Progress
        if (track.info.isStream) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${emojis.misc.clock} **Duration:** ${emojis.player.live} LIVE`)
            );
        } else {
            const progressBar = createProgressBar(position, duration, 12);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${emojis.misc.clock} **Progress:**\n${formatDuration(position)} ${progressBar} ${formatDuration(duration)}`
                )
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Additional info
        let additionalInfo = `${emojis.player.volume} **Volume:** ${player.volume}%`;

        if (player.repeatMode && player.repeatMode !== 'off') {
            additionalInfo += `\n${emojis.player.loop} **Loop:** ${player.repeatMode === 'track' ? 'Track' : 'Queue'}`;
        }

        const queueLength = player.queue.tracks.length;
        if (queueLength > 0) {
            additionalInfo += `\n${emojis.player.queue} **Queue:** ${queueLength} track${queueLength !== 1 ? 's' : ''} remaining`;
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(additionalInfo)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Footer
        const requester = track.requester;
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# Requested by ${requester?.username || 'Unknown'}`
            )
        );

        return ctx.sendMessage({ 
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
