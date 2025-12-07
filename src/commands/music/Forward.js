/**
 * Forward Command - Skip forward in the current track
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Forward extends Command {
    constructor(client, file) {
        super(client, {
            name: 'forward',
            description: {
                content: 'Skip forward in the current track',
                usage: 'forward [seconds]',
                examples: ['forward', 'forward 30'],
            },
            aliases: ['ff', 'fwd'],
            cooldown: 3,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'seconds',
                    description: 'Seconds to skip forward (default: 10)',
                    type: 4,
                    required: false,
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

        if (player.queue.current.info.isStream) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Cannot seek in a live stream!` });
        }

        const seconds = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('seconds') || 10
            : parseInt(args[0]) || 10;

        const newPosition = Math.min(player.position + (seconds * 1000), player.queue.current.info.duration);
        await player.seek(newPosition);

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.forward} Forward\nSkipped forward **${seconds}s** to \`${formatDuration(newPosition)}\``
            )
        );
        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
