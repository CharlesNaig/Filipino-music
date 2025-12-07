/**
 * Queue Command
 * 
 * Display the current queue.
 */

import Command from '../../structures/Command.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';

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
        // Get player
        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({
                content: `\`❌\` Nothing is playing right now!`,
            });
        }

        const queue = player.queue.tracks;
        const current = player.queue.current;

        // Get page number
        let page = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('page') || 1
            : parseInt(args[0]) || 1;

        const tracksPerPage = 10;
        const totalPages = Math.ceil(queue.length / tracksPerPage) || 1;

        // Clamp page number
        page = Math.max(1, Math.min(page, totalPages));

        // Build embed
        const embed = new EmbedBuilder()
            .setColor(this.client.config.color.default)
            .setAuthor({
                name: `Queue for ${ctx.guild.name}`,
                iconURL: ctx.guild.iconURL({ dynamic: true }),
            });

        // Add current track
        const currentDuration = current.info.isStream 
            ? '🔴 LIVE' 
            : `${formatDuration(player.position)}/${formatDuration(current.info.duration)}`;
        
        embed.setDescription(
            `**Now Playing:**\n` +
            `[${current.info.title}](${current.info.uri}) - \`${currentDuration}\`\n` +
            `Requested by: ${current.requester?.username || 'Unknown'}\n\n` +
            `**Up Next:** (${queue.length} track${queue.length !== 1 ? 's' : ''})`
        );

        // Add queue tracks
        if (queue.length > 0) {
            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = Math.min(startIndex + tracksPerPage, queue.length);
            const pageTracks = queue.slice(startIndex, endIndex);

            const queueList = pageTracks.map((track, index) => {
                const position = startIndex + index + 1;
                const duration = track.info.isStream ? '🔴 LIVE' : formatDuration(track.info.duration);
                const requester = track.requester?.username || 'Unknown';
                return `\`${position}.\` [${track.info.title.substring(0, 40)}${track.info.title.length > 40 ? '...' : ''}](${track.info.uri}) - \`${duration}\` (${requester})`;
            }).join('\n');

            embed.addFields({
                name: '\u200b',
                value: queueList || 'No tracks in queue',
            });
        } else {
            embed.addFields({
                name: '\u200b',
                value: 'No tracks in queue. Use `play` to add some!',
            });
        }

        // Add footer with page info
        const totalDuration = queue.reduce((acc, t) => acc + (t.info.duration || 0), 0);
        embed.setFooter({
            text: `Page ${page}/${totalPages} | Total Duration: ${formatDuration(totalDuration)} | Loop: ${player.repeatMode || 'off'}`,
        });

        // Build pagination buttons if needed
        const components = [];
        if (totalPages > 1) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('queue_first')
                        .setEmoji('⏮️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('queue_prev')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('queue_page')
                        .setLabel(`${page}/${totalPages}`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_next')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages),
                    new ButtonBuilder()
                        .setCustomId('queue_last')
                        .setEmoji('⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages),
                );
            components.push(row);
        }

        const message = await ctx.sendMessage({
            embeds: [embed],
            components,
        });

        // Set up button collector if pagination exists
        if (totalPages > 1 && message) {
            const collector = message.createMessageComponentCollector({
                filter: (i) => i.customId.startsWith('queue_') && i.user.id === ctx.author.id,
                time: 120000, // 2 minutes
            });

            let currentPage = page;

            collector.on('collect', async (interaction) => {
                switch (interaction.customId) {
                    case 'queue_first':
                        currentPage = 1;
                        break;
                    case 'queue_prev':
                        currentPage = Math.max(1, currentPage - 1);
                        break;
                    case 'queue_next':
                        currentPage = Math.min(totalPages, currentPage + 1);
                        break;
                    case 'queue_last':
                        currentPage = totalPages;
                        break;
                }

                // Rebuild embed for new page
                const newEmbed = await this._buildQueueEmbed(ctx, player, currentPage, tracksPerPage);
                const newRow = this._buildPaginationRow(currentPage, totalPages);

                await interaction.update({
                    embeds: [newEmbed],
                    components: [newRow],
                });
            });

            collector.on('end', async () => {
                try {
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('queue_first')
                                .setEmoji('⏮️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('queue_prev')
                                .setEmoji('◀️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('queue_page')
                                .setLabel(`${currentPage}/${totalPages}`)
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('queue_next')
                                .setEmoji('▶️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('queue_last')
                                .setEmoji('⏭️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                        );

                    await message.edit({ components: [disabledRow] });
                } catch (error) {
                    // Message may be deleted
                }
            });
        }
    }

    async _buildQueueEmbed(ctx, player, page, tracksPerPage) {
        const queue = player.queue.tracks;
        const current = player.queue.current;
        const totalPages = Math.ceil(queue.length / tracksPerPage) || 1;

        const embed = new EmbedBuilder()
            .setColor(this.client.config.color.default)
            .setAuthor({
                name: `Queue for ${ctx.guild.name}`,
                iconURL: ctx.guild.iconURL({ dynamic: true }),
            });

        const currentDuration = current.info.isStream 
            ? '🔴 LIVE' 
            : `${formatDuration(player.position)}/${formatDuration(current.info.duration)}`;
        
        embed.setDescription(
            `**Now Playing:**\n` +
            `[${current.info.title}](${current.info.uri}) - \`${currentDuration}\`\n` +
            `Requested by: ${current.requester?.username || 'Unknown'}\n\n` +
            `**Up Next:** (${queue.length} track${queue.length !== 1 ? 's' : ''})`
        );

        if (queue.length > 0) {
            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = Math.min(startIndex + tracksPerPage, queue.length);
            const pageTracks = queue.slice(startIndex, endIndex);

            const queueList = pageTracks.map((track, index) => {
                const position = startIndex + index + 1;
                const duration = track.info.isStream ? '🔴 LIVE' : formatDuration(track.info.duration);
                const requester = track.requester?.username || 'Unknown';
                return `\`${position}.\` [${track.info.title.substring(0, 40)}${track.info.title.length > 40 ? '...' : ''}](${track.info.uri}) - \`${duration}\` (${requester})`;
            }).join('\n');

            embed.addFields({
                name: '\u200b',
                value: queueList,
            });
        }

        const totalDuration = queue.reduce((acc, t) => acc + (t.info.duration || 0), 0);
        embed.setFooter({
            text: `Page ${page}/${totalPages} | Total Duration: ${formatDuration(totalDuration)} | Loop: ${player.repeatMode || 'off'}`,
        });

        return embed;
    }

    _buildPaginationRow(currentPage, totalPages) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('queue_first')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId('queue_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId('queue_page')
                    .setLabel(`${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('queue_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages),
                new ButtonBuilder()
                    .setCustomId('queue_last')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages),
            );
    }
}
