/**
 * Playlist Delete Command
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistDelete extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-delete',
            description: {
                content: 'Delete a playlist',
                usage: 'playlist-delete <name>',
                examples: ['playlist-delete My Favorites'],
            },
            aliases: ['pldelete', 'pl-delete', 'pl-remove'],
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
                    description: 'Name of the playlist to delete',
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

        await Playlist.deleteOne({ _id: playlist._id });
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.misc.trash} Playlist Deleted\n**${playlist.name}** has been deleted.\n${playlist.tracks.length} tracks removed.`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
