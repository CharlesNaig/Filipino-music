/**
 * Favorite List Command
 * 
 * Display user's favorite tracks
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import Favorite from '../../schemas/Favorite.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class FavoriteList extends Command {
    constructor(client, file) {
        super(client, {
            name: 'favorite-list',
            description: {
                content: 'View your favorite tracks',
                usage: 'favorite-list [page]',
                examples: ['favorite-list', 'favorites', 'favlist 2'],
            },
            aliases: ['favorites', 'favlist', 'favs', 'liked'],
            cooldown: 5,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
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
        // Get user favorites
        const favorites = await Favorite.getOrCreate(ctx.author.id);
        const tracks = favorites.tracks;

        if (tracks.length === 0) {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `\`${emojis.player.favorite}\` **Your Favorites**\n\n` +
                    `You don't have any favorite tracks yet!\n` +
                    `Use \`favorite-add\` while a track is playing to add it.`
                )
            );
            return ctx.sendMessage({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Pagination
        const tracksPerPage = 10;
        let page = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('page') || 1
            : parseInt(args[0]) || 1;
        
        const totalPages = Math.ceil(tracks.length / tracksPerPage) || 1;
        page = Math.max(1, Math.min(page, totalPages));

        // Build container
        const container = this._buildListContainer(ctx, tracks, page, tracksPerPage, totalPages);

        const message = await ctx.sendMessage({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        // Set up pagination collector
        if (totalPages > 1 && message) {
            const collector = message.createMessageComponentCollector({
                filter: (i) => i.customId.startsWith('favlist_') && i.user.id === ctx.author.id,
                time: 120000,
            });

            let currentPage = page;

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'favlist_prev') {
                    currentPage = Math.max(1, currentPage - 1);
                } else if (interaction.customId === 'favlist_next') {
                    currentPage = Math.min(totalPages, currentPage + 1);
                }

                const newContainer = this._buildListContainer(ctx, tracks, currentPage, tracksPerPage, totalPages);

                await interaction.update({
                    components: [newContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            });

            collector.on('end', async () => {
                try {
                    const finalContainer = this._buildListContainer(ctx, tracks, currentPage, tracksPerPage, totalPages, true);
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

    _buildListContainer(ctx, tracks, page, tracksPerPage, totalPages, disabled = false) {
        const container = new ContainerBuilder();

        // Header
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`\`${emojis.player.favorite}\` **${ctx.author.username}'s Favorites**`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Track list
        const startIndex = (page - 1) * tracksPerPage;
        const endIndex = Math.min(startIndex + tracksPerPage, tracks.length);
        const pageTracks = tracks.slice(startIndex, endIndex);

        const trackList = pageTracks.map((track, index) => {
            const position = startIndex + index + 1;
            const duration = formatDuration(track.duration);
            const title = track.title.length > 45 
                ? track.title.substring(0, 45) + '...' 
                : track.title;
            return `\`${position}.\` [${title}](${track.uri}) - \`${duration}\``;
        }).join('\n');

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(trackList)
        );

        // Pagination buttons
        if (totalPages > 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addActionRowComponents(row =>
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('favlist_prev')
                        .setEmoji(emojis.navigation.previous)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(disabled || page === 1),
                    new ButtonBuilder()
                        .setCustomId('favlist_next')
                        .setEmoji(emojis.navigation.next)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(disabled || page === totalPages)
                )
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Footer
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Page ${page}/${totalPages}** · ${tracks.length} favorite${tracks.length !== 1 ? 's' : ''}`
            )
        );

        return container;
    }
}
