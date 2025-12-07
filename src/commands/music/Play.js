/**
 * Play Command
 * 
 * Search and play music from various sources.
 * Supports YouTube, SoundCloud, Spotify, and direct URLs.
 */

import Command from '../../structures/Command.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';
import { getPlayerOptions, formatDuration } from '../../managers/LavalinkHandler.js';

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

    async run(ctx, args) {
        // Get query from slash command or message args
        const query = ctx.isInteraction 
            ? ctx.interaction.options.getString('query')
            : args.join(' ');

        if (!query) {
            return ctx.sendMessage({
                content: `\`❌\` Please provide a song name or URL!`,
            });
        }

        // Check if user is in a voice channel
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                content: `\`❌\` You need to be in a voice channel to play music!`,
            });
        }

        // Check bot permissions in voice channel
        const permissions = voiceChannel.permissionsFor(this.client.user);
        if (!permissions.has(PermissionFlagsBits.Connect)) {
            return ctx.sendMessage({
                content: `\`❌\` I don't have permission to join your voice channel!`,
            });
        }
        if (!permissions.has(PermissionFlagsBits.Speak)) {
            return ctx.sendMessage({
                content: `\`❌\` I don't have permission to speak in your voice channel!`,
            });
        }

        // Check if Lavalink is available
        if (!this.client.lavalink) {
            return ctx.sendMessage({
                content: `\`❌\` Music system is not available right now. Please try again later.`,
            });
        }

        // Check if any Lavalink node is connected
        const connectedNodes = this.client.lavalink.nodeManager.nodes.filter(n => n.connected);
        if (!connectedNodes.size) {
            return ctx.sendMessage({
                content: `\`❌\` No music server is available right now. Please try again in a moment.`,
            });
        }

        // Defer reply for longer processing
        await ctx.sendDeferMessage({ content: `\`🔍\` Searching...` });

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
                        content: `\`❌\` You need to be in the same voice channel as me!`,
                    });
                }
            }

            // Search for tracks
            const result = await player.search({ query }, ctx.author);

            if (result.loadType === 'error') {
                return ctx.editMessage({
                    content: `\`❌\` An error occurred while searching: ${result.exception?.message || 'Unknown error'}`,
                });
            }

            if (result.loadType === 'empty' || !result.tracks.length) {
                return ctx.editMessage({
                    content: `\`❌\` No results found for: **${query}**`,
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

                return ctx.editMessage({
                    content: `\`📜\` Added playlist **${playlist.name}** with **${result.tracks.length}** tracks!\n\`⏱️\` Total duration: **${formatDuration(totalDuration)}**`,
                });
            } else {
                // Add single track
                const track = result.tracks[0];
                await player.queue.add(track);

                // Start playing if not already
                if (!player.playing && !player.paused) {
                    await player.play();
                    return ctx.editMessage({
                        content: `\`🎵\` Now playing: **${track.info.title}** by **${track.info.author}**`,
                    });
                } else {
                    const position = player.queue.tracks.length;
                    return ctx.editMessage({
                        content: `\`📜\` Added to queue (#${position}): **${track.info.title}** by **${track.info.author}**`,
                    });
                }
            }
        } catch (error) {
            this.client.logger.error(`[Play] Error: ${error.message}`);
            return ctx.editMessage({
                content: `\`❌\` An error occurred: ${error.message}`,
            });
        }
    }
}
