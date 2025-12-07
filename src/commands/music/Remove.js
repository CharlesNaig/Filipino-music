/**
 * Remove Command - Remove a track from the queue
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class Remove extends Command {
    constructor(client, file) {
        super(client, {
            name: 'remove',
            description: {
                content: 'Remove a track from the queue',
                usage: 'remove <position>',
                examples: ['remove 3', 'remove 1'],
            },
            aliases: ['rm', 'delete'],
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
                    name: 'position',
                    description: 'Position of the track to remove',
                    type: 4,
                    required: true,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in a voice channel!` });
        }

        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Nothing is playing right now!` });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!` });
        }

        const position = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('position')
            : parseInt(args[0]);

        if (!position || isNaN(position)) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Please provide a valid track position!` });
        }

        if (position < 1 || position > player.queue.tracks.length) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Invalid position! Queue has ${player.queue.tracks.length} tracks.` });
        }

        const removed = player.queue.tracks.splice(position - 1, 1)[0];

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.misc.trash} Removed\n**${removed.info.title}**\nRemoved from position #${position}`
            )
        );
        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
