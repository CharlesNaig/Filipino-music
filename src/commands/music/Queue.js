/**
 * Queue Command
 * 
 * Display the current queue.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Queue extends Command {
    constructor(client, file) {
        super(client, {
            name: 'queue',
            description: {
                content: 'Display the current queue',
                usage: 'queue [page]',
                examples: ['queue', 'queue 2'],
            },
            aliases: ['q', 'list'],
            cooldown: 5,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'page',
                    description: 'Page number to view',
                    type: 4, // Integer
                    required: false,
                },
            ],
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

        const queue = player.queue.tracks;
        const current = player.queue.current;

        // Get page number
        let page = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('page') || 1
            : parseInt(args[0]) || 1;

        const tracksPerPage = 3;
        const totalPages = Math.ceil(queue.length / tracksPerPage) || 1;

        // Clamp page number
        page = Math.max(1, Math.min(page, totalPages));

        // Build container with pagination buttons inside
        const container = this._buildQueueContainer(ctx, player, current, queue, page, tracksPerPage, totalPages);

        const message = await ctx.sendMessage({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        // Set up button collector if pagination exists
        if (totalPages > 1 && message) {
            const collector = message.createMessageComponentCollector({
                filter: (i) => i.customId.startsWith('queue_') && i.user.id === ctx.author.id,
                time: 120000, // 2 minutes
            });

            let currentPage = page;

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'queue_prev') {
                    currentPage = Math.max(1, currentPage - 1);
                } else if (interaction.customId === 'queue_next') {
                    currentPage = Math.min(totalPages, currentPage + 1);
                }

                // Rebuild container for new page
                const newContainer = this._buildQueueContainer(ctx, player, current, queue, currentPage, tracksPerPage, totalPages);

                await interaction.update({
                    components: [newContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            });

            collector.on('end', async () => {
                try {
                    // Rebuild with disabled buttons
                    const finalContainer = this._buildQueueContainerDisabled(ctx, player, current, queue, currentPage, tracksPerPage, totalPages);
                    await message.edit({ 
                        components: [finalContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch (error) {
                    // Message may be deleted
                }
            });
        }
    }

    _buildQueueContainer(ctx, player, current, queue, page, tracksPerPage, totalPages) {
        const container = new ContainerBuilder();

        // Now Playing section with thumbnail
        const currentDuration = current.info.isStream 
            ? `${emojis.player.live} LIVE` 
            : formatDuration(current.info.duration);
        const currentThumbnail = current.info.artworkUrl || `https://img.youtube.com/vi/${current.info.identifier}/mqdefault.jpg`;
        
        const nowPlayingSection = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**${emojis.player.nowPlaying} Now Playing**\n[${current.info.title}](${current.info.uri})\n\`${currentDuration}\``
                )
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder().setURL(currentThumbnail)
            );
        container.addSectionComponents(nowPlayingSection);

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Queue tracks with thumbnails
        if (queue.length > 0) {
            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = Math.min(startIndex + tracksPerPage, queue.length);
            const pageTracks = queue.slice(startIndex, endIndex);

            pageTracks.forEach((track, index) => {
                const position = startIndex + index + 1;
                const duration = track.info.isStream ? `${emojis.player.live} LIVE` : formatDuration(track.info.duration);
                const title = track.info.title.length > 45 
                    ? track.info.title.substring(0, 45) + '...' 
                    : track.info.title;
                const thumbnail = track.info.artworkUrl || `https://img.youtube.com/vi/${track.info.identifier}/mqdefault.jpg`;

                // Track section with thumbnail accessory
                const trackSection = new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**${position}.** [${title}](${track.info.uri})\n\`${duration}\``
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(thumbnail)
                    );
                container.addSectionComponents(trackSection);

                // Add separator between tracks (except last one)
                if (index < pageTracks.length - 1) {
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                }
            });
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('No tracks in queue. Use `play` to add some!')
            );
        }

        // Pagination buttons inside container
        if (totalPages > 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addActionRowComponents(row => 
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('queue_prev')
                        .setEmoji(emojis.navigation.previous)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('queue_next')
                        .setEmoji(emojis.navigation.next)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages)
                )
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Footer with page info
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Page ${page}/${totalPages}** · ${queue.length} track${queue.length !== 1 ? 's' : ''} in queue`
            )
        );

        return container;
    }

    _buildQueueContainerDisabled(ctx, player, current, queue, page, tracksPerPage, totalPages) {
        const container = new ContainerBuilder();

        // Now Playing section with thumbnail
        const currentDuration = current.info.isStream 
            ? `${emojis.player.live} LIVE` 
            : formatDuration(current.info.duration);
        const currentThumbnail = current.info.artworkUrl || `https://img.youtube.com/vi/${current.info.identifier}/mqdefault.jpg`;
        
        const nowPlayingSection = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**${emojis.player.nowPlaying} Now Playing**\n[${current.info.title}](${current.info.uri})\n\`${currentDuration}\``
                )
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder().setURL(currentThumbnail)
            );
        container.addSectionComponents(nowPlayingSection);

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Queue tracks with thumbnails
        if (queue.length > 0) {
            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = Math.min(startIndex + tracksPerPage, queue.length);
            const pageTracks = queue.slice(startIndex, endIndex);

            pageTracks.forEach((track, index) => {
                const position = startIndex + index + 1;
                const duration = track.info.isStream ? `${emojis.player.live} LIVE` : formatDuration(track.info.duration);
                const title = track.info.title.length > 45 
                    ? track.info.title.substring(0, 45) + '...' 
                    : track.info.title;
                const thumbnail = track.info.artworkUrl || `https://img.youtube.com/vi/${track.info.identifier}/mqdefault.jpg`;

                // Track section with thumbnail accessory
                const trackSection = new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**${position}.** [${title}](${track.info.uri})\n\`${duration}\``
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(thumbnail)
                    );
                container.addSectionComponents(trackSection);

                if (index < pageTracks.length - 1) {
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                }
            });
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('No tracks in queue. Use `play` to add some!')
            );
        }

        // Disabled pagination buttons
        if (totalPages > 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addActionRowComponents(row => 
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('queue_prev')
                        .setEmoji(emojis.navigation.previous)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_next')
                        .setEmoji(emojis.navigation.next)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                )
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Page ${page}/${totalPages}** · ${queue.length} track${queue.length !== 1 ? 's' : ''} in queue`
            )
        );

        return container;
    }
}
