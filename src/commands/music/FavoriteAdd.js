/**
 * Favorite Add Command
 * 
 * Add the currently playing track to favorites
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Favorite from '../../schemas/Favorite.js';
import emojis from '../../emojis.js';

export default class FavoriteAdd extends Command {
    constructor(client, file) {
        super(client, {
            name: 'favorite-add',
            description: {
                content: 'Add the current track to your favorites',
                usage: 'favorite-add',
                examples: ['favorite-add', 'fav'],
            },
            aliases: ['fav', 'favadd', 'addfav', 'like'],
            cooldown: 3,
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
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You need to be in a voice channel!`,
            });
        }

        // Get player
        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` Nothing is playing right now!`,
            });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({
                content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!`,
            });
        }

        const track = player.queue.current;
        
        // Get or create user favorites
        const favorites = await Favorite.getOrCreate(ctx.author.id);
        
        // Add track to favorites
        const result = await favorites.addTrack({
            title: track.info.title,
            author: track.info.author,
            uri: track.info.uri,
            duration: track.info.duration,
            artworkUrl: track.info.artworkUrl
        });

        const container = new ContainerBuilder();
        
        if (result.success) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `\`${emojis.player.favorite}\` Added **${track.info.title}** to your favorites!`
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
