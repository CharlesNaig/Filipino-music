/**
 * Disconnect Command - Disconnect the bot from voice channel
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class Disconnect extends Command {
    constructor(client, file) {
        super(client, {
            name: 'disconnect',
            description: {
                content: 'Disconnect the bot from the voice channel',
                usage: 'disconnect',
                examples: ['disconnect', 'leave'],
            },
            aliases: ['leave', 'dc', 'bye'],
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
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in a voice channel!` });
        }

        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` I'm not in a voice channel!` });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!` });
        }

        const playerVoiceChannel = ctx.guild.channels.cache.get(player.voiceChannelId);
        await player.destroy();

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.misc.wave} Disconnected\nLeft **${playerVoiceChannel?.name || 'voice channel'}** and cleared the queue.`
            )
        );
        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
