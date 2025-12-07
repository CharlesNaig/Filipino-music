/**
 * Move Command - Move a track to a different position in the queue
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class Move extends Command {
    constructor(client, file) {
        super(client, {
            name: 'move',
            description: {
                content: 'Move a track to a different position in the queue',
                usage: 'move <from> <to>',
                examples: ['move 5 1', 'move 3 2'],
            },
            aliases: ['mv'],
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
                    name: 'from',
                    description: 'Current position of the track',
                    type: 4,
                    required: true,
                },
                {
                    name: 'to',
                    description: 'New position for the track',
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

        let from, to;
        if (ctx.isInteraction) {
            from = ctx.interaction.options.getInteger('from');
            to = ctx.interaction.options.getInteger('to');
        } else {
            from = parseInt(args[0]);
            to = parseInt(args[1]);
        }

        if (!from || !to || isNaN(from) || isNaN(to)) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Usage: \`move <from> <to>\`` });
        }

        const queueLength = player.queue.tracks.length;
        if (from < 1 || from > queueLength || to < 1 || to > queueLength) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Invalid positions! Queue has ${queueLength} tracks.` });
        }

        if (from === to) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Track is already at that position!` });
        }

        // Remove track from original position
        const [track] = player.queue.tracks.splice(from - 1, 1);
        // Insert at new position
        player.queue.tracks.splice(to - 1, 0, track);

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.misc.position} Moved\n**${track.info.title}**\nMoved from #${from} to #${to}`
            )
        );
        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
