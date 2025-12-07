/**
 * Resume Command
 * 
 * Resume paused playback.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class Resume extends Command {
    constructor(client, file) {
        super(client, {
            name: 'resume',
            description: {
                content: 'Resume paused playback',
                usage: 'resume',
                examples: ['resume'],
            },
            aliases: ['unpause', 'continue'],
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

        if (!player.paused) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.player.play} Already Playing`, 'Playback is not paused.')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            await player.resume();

            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.player.play} Resumed`, 'Playback resumed!')],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[Resume] Error: ${error.message}`);
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Failed to resume: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
