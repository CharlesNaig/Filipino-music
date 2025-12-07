/**
 * Lyrics Command - Get lyrics for the current track
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class Lyrics extends Command {
    constructor(client, file) {
        super(client, {
            name: 'lyrics',
            description: {
                content: 'Get lyrics for the current or specified track',
                usage: 'lyrics [song name]',
                examples: ['lyrics', 'lyrics never gonna give you up'],
            },
            aliases: ['ly'],
            cooldown: 5,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'query',
                    description: 'Song name to search lyrics for',
                    type: 3,
                    required: false,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        let query;
        
        if (ctx.isInteraction) {
            query = ctx.interaction.options.getString('query');
        } else {
            query = args.join(' ');
        }

        // If no query, use current track
        if (!query) {
            const player = this.client.lavalink?.players.get(ctx.guild.id);
            if (!player || !player.queue.current) {
                return ctx.sendMessage({ content: `\`${emojis.status.error}\` Nothing is playing! Provide a song name to search.` });
            }
            query = `${player.queue.current.info.title} ${player.queue.current.info.author}`;
        }

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emojis.player.lyrics} Lyrics`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${query}**\n\n` +
                `Lyrics feature coming soon!\n\n` +
                `-# This feature will be available in a future update.`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
