/**
 * Playlist Create Command
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistCreate extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-create',
            description: {
                content: 'Create a new playlist',
                usage: 'playlist-create <name>',
                examples: ['playlist-create My Favorites', 'playlist-create Chill Vibes'],
            },
            aliases: ['plcreate', 'pl-create'],
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
                    description: 'Name for the playlist',
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

        if (!name || name.length < 1) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Please provide a playlist name!` });
        }

        if (name.length > 50) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist name must be 50 characters or less!` });
        }

        const result = await Playlist.createPlaylist(ctx.author.id, name);
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                result.success 
                    ? `### ${emojis.player.playlist} Playlist Created\n**${name}**\n\nUse \`playlist-track-add\` to add tracks!`
                    : `### ${emojis.status.error} Error\n${result.message}`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
