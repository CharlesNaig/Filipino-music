/**
 * Playlist Track Remove Command
 * Remove a track from a playlist
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistTrackRemove extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-track-remove',
            description: {
                content: 'Remove a track from a playlist',
                usage: 'playlist-track-remove <playlist> | <track number>',
                examples: ['playlist-track-remove My Favorites | 3'],
            },
            aliases: ['pltrackremove', 'pl-track-remove'],
            cooldown: 3,
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
                    name: 'track_number',
                    description: 'Track number to remove',
                    type: 4,
                    required: true,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        let playlistName, trackNum;

        if (ctx.isInteraction) {
            playlistName = ctx.interaction.options.getString('playlist');
            trackNum = ctx.interaction.options.getInteger('track_number');
        } else {
            const parts = args.join(' ').split('|').map(p => p.trim());
            if (parts.length !== 2) {
                return ctx.sendMessage({ content: `\`${emojis.status.error}\` Usage: \`playlist-track-remove <playlist> | <track number>\`` });
            }
            playlistName = parts[0];
            trackNum = parseInt(parts[1]);
            
            if (isNaN(trackNum)) {
                return ctx.sendMessage({ content: `\`${emojis.status.error}\` Please provide a valid track number!` });
            }
        }

        const playlist = await Playlist.findByName(ctx.author.id, playlistName);
        
        if (!playlist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${playlistName}" not found!` });
        }

        const result = await playlist.removeTrack(trackNum);
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                result.success 
                    ? `### ${emojis.misc.remove} Track Removed\n**${result.track.title}**\n\nRemoved from **${playlist.name}**`
                    : `### ${emojis.status.error} Error\n${result.message}`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
