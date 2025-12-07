/**
 * Favorite Remove Command
 * 
 * Remove a track from favorites
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Favorite from '../../schemas/Favorite.js';
import emojis from '../../emojis.js';

export default class FavoriteRemove extends Command {
    constructor(client, file) {
        super(client, {
            name: 'favorite-remove',
            description: {
                content: 'Remove a track from your favorites',
                usage: 'favorite-remove <number>',
                examples: ['favorite-remove 1', 'unfav 3'],
            },
            aliases: ['unfav', 'favremove', 'removefav', 'unlike'],
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
                    name: 'number',
                    description: 'Track number to remove (use favorite-list to see numbers)',
                    type: 4, // Integer
                    required: true,
                },
            ],
            category: 'music',
        });

        this.file = file;
    }

    async run(ctx, args) {
        // Get track number
        const trackNum = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('number')
            : parseInt(args[0]);

        if (!trackNum || isNaN(trackNum)) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` Please provide a valid track number! Use \`favorite-list\` to see your favorites.`,
            });
        }

        // Get user favorites
        const favorites = await Favorite.getOrCreate(ctx.author.id);

        if (favorites.tracks.length === 0) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You don't have any favorite tracks!`,
            });
        }

        // Remove track
        const result = await favorites.removeTrack(trackNum);

        const container = new ContainerBuilder();
        
        if (result.success) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `\`${emojis.player.unfavorite}\` Removed **${result.track.title}** from your favorites.`
                )
            );
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `\`${emojis.status.error}\` ${result.message}`
                )
            );
        }

        return ctx.sendMessage({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
