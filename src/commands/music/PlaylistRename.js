/**
 * Playlist Rename Command
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistRename extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-rename',
            description: {
                content: 'Rename a playlist',
                usage: 'playlist-rename <old name> | <new name>',
                examples: ['playlist-rename My Favorites | Best Songs'],
            },
            aliases: ['plrename', 'pl-rename'],
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
                    name: 'old_name',
                    description: 'Current name of the playlist',
                    type: 3,
                    required: true,
                },
                {
                    name: 'new_name',
                    description: 'New name for the playlist',
                    type: 3,
                    required: true,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        let oldName, newName;

        if (ctx.isInteraction) {
            oldName = ctx.interaction.options.getString('old_name');
            newName = ctx.interaction.options.getString('new_name');
        } else {
            const parts = args.join(' ').split('|').map(p => p.trim());
            if (parts.length !== 2) {
                return ctx.sendMessage({ content: '`❌` Usage: `playlist-rename <old name> | <new name>`' });
            }
            [oldName, newName] = parts;
        }

        if (newName.length > 50) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist name must be 50 characters or less!` });
        }

        const playlist = await Playlist.findByName(ctx.author.id, oldName);
        
        if (!playlist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${oldName}" not found!` });
        }

        const result = await playlist.rename(newName);
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                result.success 
                    ? `### ${emojis.status.success} Playlist Renamed\n**${oldName}** → **${newName}**`
                    : `### ${emojis.status.error} Error\n${result.message}`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
