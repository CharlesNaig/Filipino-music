/**
 * Playlist Load Command
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import { getPlayerOptions } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class PlaylistLoad extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-load',
            description: {
                content: 'Load and play a playlist',
                usage: 'playlist-load <name> [shuffle]',
                examples: ['playlist-load My Favorites', 'playlist-load Chill shuffle'],
            },
            aliases: ['plload', 'pl-load', 'plplay'],
            cooldown: 5,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'Connect', 'Speak'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'name',
                    description: 'Name of the playlist to load',
                    type: 3,
                    required: true,
                },
                {
                    name: 'shuffle',
                    description: 'Shuffle the playlist',
                    type: 5,
                    required: false,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        const member = ctx.guild.members.cache.get(ctx.author.id);
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in a voice channel!` });
        }

        const name = ctx.isInteraction 
            ? ctx.interaction.options.getString('name')
            : args.filter(a => a.toLowerCase() !== 'shuffle').join(' ');
        
        const shuffle = ctx.isInteraction 
            ? ctx.interaction.options.getBoolean('shuffle')
            : args.some(a => a.toLowerCase() === 'shuffle');

        const playlist = await Playlist.findByName(ctx.author.id, name);
        
        if (!playlist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${name}" not found!` });
        }

        if (playlist.tracks.length === 0) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${name}" is empty!` });
        }

        // Get or create player
        let player = this.client.lavalink?.players.get(ctx.guild.id);

        if (player && player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!` });
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

        // Get tracks to add
        let tracks = [...playlist.tracks];
        if (shuffle) {
            tracks = tracks.sort(() => Math.random() - 0.5);
        }

        // Search and add tracks
        let addedCount = 0;
        for (const track of tracks) {
            try {
                const result = await player.search({ query: track.uri }, ctx.author);
                if (result.tracks.length > 0) {
                    await player.queue.add(result.tracks[0]);
                    addedCount++;
                }
            } catch (error) {
                this.client.logger.error(`[PlaylistLoad] Failed to add track: ${error.message}`);
            }
        }

        // Start playing if not already
        if (!player.playing && !player.paused) {
            await player.play();
        }

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.playlist} Playlist Loaded\n**${playlist.name}**\n\n` +
                `${shuffle ? `${emojis.player.shuffle} Shuffled and added` : 'Added'} **${addedCount}** tracks to queue!`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
