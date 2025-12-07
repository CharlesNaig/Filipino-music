/**
 * Playlist Share Command
 * Toggle playlist visibility (public/private)
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistShare extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-share',
            description: {
                content: 'Toggle playlist visibility (public/private)',
                usage: 'playlist-share <name>',
                examples: ['playlist-share My Favorites'],
            },
            aliases: ['plshare', 'pl-share'],
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
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        const name = ctx.isInteraction 
            ? ctx.interaction.options.getString('name')
            : args.join(' ');

        const playlist = await Playlist.findByName(ctx.author.id, name);
        
        if (!playlist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${name}" not found!` });
        }

        playlist.isPublic = !playlist.isPublic;
        playlist.updatedAt = new Date();
        await playlist.save();
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                playlist.isPublic 
                    ? `### ${emojis.misc.link} Playlist Public\n**${playlist.name}** is now public!\n\nShare ID: \`${playlist._id}\`\nOthers can import it with \`playlist-import ${playlist._id}\``
                    : `### ${emojis.misc.settings} Playlist Private\n**${playlist.name}** is now private.`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
