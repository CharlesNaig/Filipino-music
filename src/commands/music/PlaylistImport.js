/**
 * Playlist Import Command
 * Import a public playlist from another user
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistImport extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-import',
            description: {
                content: 'Import a public playlist from another user',
                usage: 'playlist-import <playlist-id>',
                examples: ['playlist-import pl_abc123'],
            },
            aliases: ['plimport', 'pl-import'],
            cooldown: 10,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'playlist_id',
                    description: 'ID of the public playlist to import',
                    type: 3,
                    required: true,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        const playlistId = ctx.isInteraction 
            ? ctx.interaction.options.getString('playlist_id')
            : args[0];

        const sourcePlaylist = await Playlist.findPublicById(playlistId);
        
        if (!sourcePlaylist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist not found or is not public!` });
        }

        if (sourcePlaylist.userId === ctx.author.id) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You cannot import your own playlist!` });
        }

        // Create new playlist with imported tracks
        const newName = `${sourcePlaylist.name} (imported)`;
        const result = await Playlist.createPlaylist(ctx.author.id, newName);
        
        if (!result.success) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` ${result.message}` });
        }

        const newPlaylist = result.playlist;

        // Copy tracks
        for (const track of sourcePlaylist.tracks) {
            await newPlaylist.addTrack({
                title: track.title,
                author: track.author,
                uri: track.uri,
                duration: track.duration,
                artworkUrl: track.artworkUrl
            });
        }
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.misc.add} Playlist Imported\n**${newName}**\n\nImported **${sourcePlaylist.tracks.length}** tracks!`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
