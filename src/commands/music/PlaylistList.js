/**
 * Playlist List Command
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class PlaylistList extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-list',
            description: {
                content: 'View all your playlists',
                usage: 'playlist-list',
                examples: ['playlist-list', 'playlists'],
            },
            aliases: ['playlists', 'pllist', 'pl-list'],
            cooldown: 5,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx) {
        const playlists = await Playlist.getUserPlaylists(ctx.author.id);
        
        const container = new ContainerBuilder();
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emojis.player.playlist} Your Playlists`)
        );
        
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        if (playlists.length === 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `You don't have any playlists yet!\nUse \`playlist-create <name>\` to create one.`
                )
            );
        } else {
            const playlistList = playlists.map((pl, i) => {
                const duration = formatDuration(pl.getTotalDuration());
                const visibility = pl.isPublic ? emojis.misc.link : emojis.misc.settings;
                return `**${i + 1}.** ${visibility} **${pl.name}** — ${pl.tracks.length} tracks \`${duration}\``;
            }).join('\n');

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(playlistList)
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${playlists.length}/25 playlists`)
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
