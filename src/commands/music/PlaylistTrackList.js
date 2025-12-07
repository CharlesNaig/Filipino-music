/**
 * Playlist Track List Command
 * View tracks in a playlist
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class PlaylistTrackList extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-track-list',
            description: {
                content: 'View tracks in a playlist',
                usage: 'playlist-track-list <name>',
                examples: ['playlist-track-list My Favorites'],
            },
            aliases: ['pltracks', 'pl-tracks', 'plview'],
            cooldown: 5,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'name',
                    description: 'Name of the playlist',
                    type: 3,
                    required: true,
                },
                {
                    name: 'page',
                    description: 'Page number',
                    type: 4,
                    required: false,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        let name, page;

        if (ctx.isInteraction) {
            name = ctx.interaction.options.getString('name');
            page = ctx.interaction.options.getInteger('page') || 1;
        } else {
            name = args.slice(0, -1).join(' ') || args.join(' ');
            page = parseInt(args[args.length - 1]) || 1;
            if (isNaN(parseInt(args[args.length - 1]))) {
                name = args.join(' ');
                page = 1;
            }
        }

        const playlist = await Playlist.findByName(ctx.author.id, name);
        
        if (!playlist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${name}" not found!` });
        }

        const tracksPerPage = 10;
        const totalPages = Math.ceil(playlist.tracks.length / tracksPerPage) || 1;
        page = Math.max(1, Math.min(page, totalPages));

        const container = this._buildContainer(playlist, page, tracksPerPage, totalPages);

        const message = await ctx.sendMessage({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2 
        });

        if (totalPages > 1 && message) {
            const collector = message.createMessageComponentCollector({
                filter: (i) => i.customId.startsWith('pltracks_') && i.user.id === ctx.author.id,
                time: 120000,
            });

            let currentPage = page;

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'pltracks_prev') {
                    currentPage = Math.max(1, currentPage - 1);
                } else if (interaction.customId === 'pltracks_next') {
                    currentPage = Math.min(totalPages, currentPage + 1);
                }

                const newContainer = this._buildContainer(playlist, currentPage, tracksPerPage, totalPages);
                await interaction.update({ components: [newContainer], flags: MessageFlags.IsComponentsV2 });
            });

            collector.on('end', async () => {
                try {
                    const finalContainer = this._buildContainer(playlist, currentPage, tracksPerPage, totalPages, true);
                    await message.edit({ components: [finalContainer], flags: MessageFlags.IsComponentsV2 });
                } catch (error) {}
            });
        }
    }

    _buildContainer(playlist, page, tracksPerPage, totalPages, disabled = false) {
        const container = new ContainerBuilder();

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.queue} ${playlist.name}\n${playlist.isPublic ? `${emojis.misc.link} Public` : `${emojis.misc.settings} Private`} · ${playlist.tracks.length} tracks · ${formatDuration(playlist.getTotalDuration())}`
            )
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        if (playlist.tracks.length === 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('No tracks in this playlist.\nUse `playlist-track-add` to add some!')
            );
        } else {
            const startIndex = (page - 1) * tracksPerPage;
            const pageTracks = playlist.tracks.slice(startIndex, startIndex + tracksPerPage);

            const trackList = pageTracks.map((track, i) => {
                const duration = formatDuration(track.duration);
                const title = track.title.length > 40 ? track.title.substring(0, 40) + '...' : track.title;
                return `\`${startIndex + i + 1}.\` [${title}](${track.uri}) \`${duration}\``;
            }).join('\n');

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(trackList)
            );
        }

        if (totalPages > 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('pltracks_prev')
                        .setEmoji(emojis.navigation.previous)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(disabled || page === 1),
                    new ButtonBuilder()
                        .setCustomId('pltracks_next')
                        .setEmoji(emojis.navigation.next)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(disabled || page === totalPages)
                )
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Page ${page}/${totalPages}`)
        );

        return container;
    }
}
