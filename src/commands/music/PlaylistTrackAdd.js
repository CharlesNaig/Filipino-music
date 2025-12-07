/**
 * Playlist Track Add Command
 * Add a track by search query to a playlist
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistTrackAdd extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-track-add',
            description: {
                content: 'Add a track to a playlist by search',
                usage: 'playlist-track-add <playlist> | <query>',
                examples: ['playlist-track-add My Favorites | never gonna give you up'],
            },
            aliases: ['pltrackadd', 'pl-track-add'],
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
                    name: 'playlist',
                    description: 'Name of the playlist',
                    type: 3,
                    required: true,
                },
                {
                    name: 'query',
                    description: 'Song name or URL to add',
                    type: 3,
                    required: true,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        let playlistName, query;

        if (ctx.isInteraction) {
            playlistName = ctx.interaction.options.getString('playlist');
            query = ctx.interaction.options.getString('query');
        } else {
            const parts = args.join(' ').split('|').map(p => p.trim());
            if (parts.length !== 2) {
                return ctx.sendMessage({ content: `\`${emojis.status.error}\` Usage: \`playlist-track-add <playlist> | <query>\`` });
            }
            [playlistName, query] = parts;
        }

        const playlist = await Playlist.findByName(ctx.author.id, playlistName);
        
        if (!playlist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${playlistName}" not found!` });
        }

        // Search for track
        if (!this.client.lavalink) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Music system is not available!` });
        }

        // Get any connected node to search
        const nodes = this.client.lavalink.nodeManager.nodes;
        let node = null;
        if (typeof nodes.values === 'function') {
            for (const n of nodes.values()) {
                if (n.connected) { node = n; break; }
            }
        }

        if (!node) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` No music server available!` });
        }

        try {
            const result = await this.client.lavalink.search({ query }, ctx.author);
            
            if (!result.tracks.length) {
                return ctx.sendMessage({ content: `\`${emojis.status.error}\` No results found for: ${query}` });
            }

            const track = result.tracks[0];
            const addResult = await playlist.addTrack({
                title: track.info.title,
                author: track.info.author,
                uri: track.info.uri,
                duration: track.info.duration,
                artworkUrl: track.info.artworkUrl
            });
            
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    addResult.success 
                        ? `### ${emojis.misc.add} Track Added\n**${track.info.title}**\nby ${track.info.author}\n\nAdded to **${playlist.name}**`
                        : `### ${emojis.status.error} Error\n${addResult.message}`
                )
            );

            return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Error searching: ${error.message}` });
        }
    }
}
