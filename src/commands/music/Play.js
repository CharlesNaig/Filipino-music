/**
 * Play Command
 * 
 * Search and play music from various sources.
 * Supports YouTube, SoundCloud, Spotify, and direct URLs.
 */

import Command from '../../structures/Command.js';
import { ApplicationCommandOptionType, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';
import { getPlayerOptions, formatDuration } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Play extends Command {
    constructor(client, file) {
        super(client, {
            name: 'play',
            description: {
                content: 'Play a song or playlist from YouTube, Spotify, SoundCloud, etc.',
                usage: 'play <query/url>',
                examples: ['play never gonna give you up', 'play https://youtube.com/watch?v=...'],
            },
            aliases: ['p'],
            cooldown: 3,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks', 'Connect', 'Speak'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'query',
                    description: 'Song name or URL to play',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
            category: 'music',
        });

        this.file = file;
    }

    _buildContainer(title, message) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${title}\n${message}`)
        );
        return container;
    }

    async run(ctx, args) {
        // Get query from slash command or message args
        const query = ctx.isInteraction 
            ? ctx.interaction.options.getString('query')
            : args.join(' ');

        if (!query) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Please provide a song name or URL!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Check if user is in a voice channel
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'You need to be in a voice channel to play music!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Check bot permissions in voice channel
        const permissions = voiceChannel.permissionsFor(this.client.user);
        if (!permissions.has(PermissionFlagsBits.Connect)) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, "I don't have permission to join your voice channel!")],
                flags: MessageFlags.IsComponentsV2
            });
        }
        if (!permissions.has(PermissionFlagsBits.Speak)) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, "I don't have permission to speak in your voice channel!")],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Check if Lavalink is available
        if (!this.client.lavalink) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Music system is not available right now. Please try again later.')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Check if any Lavalink node is connected
        const connectedNodes = this.client.lavalink.nodeManager.nodes.filter(n => n.connected);
        if (!connectedNodes.size) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'No music server is available right now. Please try again in a moment.')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Defer reply for longer processing
        const searchContainer = new ContainerBuilder();
        searchContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emojis.status.loading} Searching...\nLooking for: **${query}**`)
        );
        await ctx.sendDeferMessage({ 
            components: [searchContainer],
            flags: MessageFlags.IsComponentsV2
        });

        try {
            // Get or create player
            let player = this.client.lavalink.players.get(ctx.guild.id);

            if (!player) {
                // Create new player
                const playerOptions = getPlayerOptions({
                    guildId: ctx.guild.id,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: ctx.channel.id,
                }, this.client.config);

                player = await this.client.lavalink.createPlayer(playerOptions);

                // Connect to voice
                await player.connect();

                // Create/update guild assignment
                await GuildAssignment.getOrCreateAssignment(
                    ctx.guild.id,
                    this.client.botId,
                    this.client.botConfig.clientId,
                    'auto'
                );

                // Activate assignment
                const assignment = await GuildAssignment.findById(ctx.guild.id);
                if (assignment) {
                    await assignment.activate(voiceChannel.id, ctx.channel.id);
                }
            } else {
                // Check if user is in the same voice channel
                if (player.voiceChannelId !== voiceChannel.id) {
                    return ctx.editMessage({
                        components: [this._buildContainer(`${emojis.status.error} Error`, 'You need to be in the same voice channel as me!')],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }

            // Search for tracks
            const result = await player.search({ query }, ctx.author);

            if (result.loadType === 'error') {
                return ctx.editMessage({
                    components: [this._buildContainer(`${emojis.status.error} Error`, `An error occurred while searching: ${result.exception?.message || 'Unknown error'}`)],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            if (result.loadType === 'empty' || !result.tracks.length) {
                return ctx.editMessage({
                    components: [this._buildContainer(`${emojis.status.error} Error`, `No results found for: **${query}**`)],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            // Handle different result types
            if (result.loadType === 'playlist') {
                // Add all tracks from playlist
                const playlist = result.playlist;
                
                for (const track of result.tracks) {
                    await player.queue.add(track);
                }

                // Start playing if not already
                if (!player.playing && !player.paused) {
                    await player.play();
                }

                const totalDuration = result.tracks.reduce((acc, t) => acc + (t.info.duration || 0), 0);

                const playlistContainer = new ContainerBuilder();
                playlistContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${emojis.player.queue} Playlist Added`)
                );
                playlistContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                playlistContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${playlist.name}**\n` +
                        `${emojis.player.music} **Tracks:** ${result.tracks.length}\n` +
                        `${emojis.misc.clock} **Duration:** ${formatDuration(totalDuration)}`
                    )
                );

                return ctx.editMessage({
                    components: [playlistContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                // Add single track
                const track = result.tracks[0];
                await player.queue.add(track);

                // Start playing if not already
                if (!player.playing && !player.paused) {
                    await player.play();

                    const nowPlayingContainer = new ContainerBuilder();
                    nowPlayingContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${emojis.player.music} Now Playing`)
                    );
                    nowPlayingContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                    nowPlayingContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**[${track.info.title}](${track.info.uri})**\n` +
                            `${emojis.misc.user} **Artist:** ${track.info.author}\n` +
                            `${emojis.misc.clock} **Duration:** ${track.info.isStream ? `${emojis.player.live} LIVE` : formatDuration(track.info.duration)}`
                        )
                    );

                    return ctx.editMessage({
                        components: [nowPlayingContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } else {
                    const position = player.queue.tracks.length;

                    const queuedContainer = new ContainerBuilder();
                    queuedContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${emojis.player.queue} Added to Queue`)
                    );
                    queuedContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                    queuedContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**[${track.info.title}](${track.info.uri})**\n` +
                            `${emojis.misc.user} **Artist:** ${track.info.author}\n` +
                            `${emojis.misc.clock} **Duration:** ${track.info.isStream ? `${emojis.player.live} LIVE` : formatDuration(track.info.duration)}\n` +
                            `${emojis.misc.position} **Position:** #${position}`
                        )
                    );

                    return ctx.editMessage({
                        components: [queuedContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
        } catch (error) {
            this.client.logger.error(`[Play] Error: ${error.message}`);
            return ctx.editMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `An error occurred: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
