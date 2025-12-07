/**
 * Stop Command
 * 
 * Stop playback, clear the queue, and disconnect.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';
import PlayerSchema from '../../schemas/Player.js';
import emojis from '../../emojis.js';

export default class Stop extends Command {
    constructor(client, file) {
        super(client, {
            name: 'stop',
            description: {
                content: 'Stop playback, clear the queue, and disconnect',
                usage: 'stop',
                examples: ['stop'],
            },
            aliases: ['dc', 'disconnect', 'leave'],
            cooldown: 3,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [],
            category: 'music',
        });

        this.file = file;
    }

    _buildContainer(title, message) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${title}\n${message}`)
        );
        return container;
    }

    async run(ctx, args) {
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'You need to be in a voice channel!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Nothing is playing right now!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'You need to be in the same voice channel as me!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            await player.destroy();
            await PlayerSchema.markDestroyed(ctx.guild.id);

            const assignment = await GuildAssignment.findById(ctx.guild.id);
            if (assignment) {
                await assignment.deactivate();
            }

            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.player.stop} Stopped`, 'Stopped playback and disconnected. Thanks for listening!')],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[Stop] Error: ${error.message}`);
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Failed to stop: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
