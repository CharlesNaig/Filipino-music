/**
 * Favorite Play Command
 * 
 * Play tracks from your favorites
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Favorite from '../../schemas/Favorite.js';
import { getPlayerOptions } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class FavoritePlay extends Command {
    constructor(client, file) {
        super(client, {
            name: 'favorite-play',
            description: {
                content: 'Play a track from your favorites or all favorites',
                usage: 'favorite-play [number|all|shuffle]',
                examples: ['favorite-play', 'favorite-play 1', 'favorite-play all', 'favorite-play shuffle'],
            },
            aliases: ['favplay', 'playfav', 'pf'],
            cooldown: 3,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'Connect', 'Speak'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'track',
                    description: 'Track number, "all", or "shuffle"',
                    type: 3, // String
                    required: false,
                },
            ],
            category: 'music',
        });

        this.file = file;
    }

    async run(ctx, args) {
        // Check if user is in a voice channel
        const member = ctx.guild.members.cache.get(ctx.author.id);
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You need to be in a voice channel!`,
            });
        }

        // Get user favorites
        const favorites = await Favorite.getOrCreate(ctx.author.id);
        const tracks = favorites.tracks;

        if (tracks.length === 0) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You don't have any favorite tracks! Use \`favorite-add\` to add some.`,
            });
        }

        // Parse argument
        const arg = ctx.isInteraction 
            ? ctx.interaction.options.getString('track')?.toLowerCase()
            : args[0]?.toLowerCase();

        let tracksToPlay = [];
        let message = '';

        if (!arg || arg === 'all') {
            // Play all favorites
            tracksToPlay = [...tracks];
            message = `\`${emojis.player.favorite}\` Playing all **${tracks.length}** favorites!`;
        } else if (arg === 'shuffle') {
            // Shuffle and play all
            tracksToPlay = [...tracks].sort(() => Math.random() - 0.5);
            message = `\`${emojis.player.shuffle}\` Shuffling and playing **${tracks.length}** favorites!`;
        } else {
            // Play specific track by number
            const trackNum = parseInt(arg);
            if (isNaN(trackNum) || trackNum < 1 || trackNum > tracks.length) {
                return ctx.sendMessage({
                    content: `\`${emojis.status.error}\` Invalid track number! Use a number between 1 and ${tracks.length}.`,
                });
            }
            tracksToPlay = [tracks[trackNum - 1]];
            message = `\`${emojis.player.favorite}\` Playing favorite #${trackNum}: **${tracks[trackNum - 1].title}**`;
        }

        // Get or create player
        let player = this.client.lavalink?.players.get(ctx.guild.id);

        if (player && player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!`,
            });
        }

        if (!player) {
            const playerOptions = getPlayerOptions({
                guildId: ctx.guild.id,
                voiceChannelId: voiceChannel.id,
                textChannelId: ctx.channel.id,
            }, this.client.config);

            player = await this.client.lavalink.createPlayer(playerOptions);
            await player.connect();
        }

        // Search and add tracks
        let addedCount = 0;
        for (const track of tracksToPlay) {
            try {
                const result = await player.search({ query: track.uri }, ctx.author);
                if (result.tracks.length > 0) {
                    await player.queue.add(result.tracks[0]);
                    addedCount++;
                }
            } catch (error) {
                this.client.logger.error(`[FavoritePlay] Failed to add track: ${error.message}`);
            }
        }

        // Start playing if not already
        if (!player.playing && !player.paused) {
            await player.play();
        }

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                addedCount > 0 
                    ? message 
                    : `\`${emojis.status.error}\` Failed to add any tracks to the queue.`
            )
        );

        return ctx.sendMessage({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
