/**
 * 24/7 Command
 * 
 * Toggle 24/7 mode (stay in voice channel when queue is empty).
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';
import Schema247 from '../../schemas/247.js';
import emojis from '../../emojis.js';

export default class TwentyFourSeven extends Command {
    constructor(client, file) {
        super(client, {
            name: '247',
            description: {
                content: 'Toggle 24/7 mode (stay in voice channel when queue is empty)',
                usage: '247',
                examples: ['247'],
            },
            aliases: ['twentyfourseven', '24-7', 'stay'],
            cooldown: 5,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: ['ManageGuild'],
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
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Nothing is playing right now! Start playing music first.')],
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
            const current247 = player.get('twentyFourSeven') || false;
            const new247 = !current247;

            player.set('twentyFourSeven', new247);

            await Schema247.findOneAndUpdate(
                { _id: ctx.guild.id },
                { 
                    enabled: new247,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: ctx.channel.id,
                },
                { upsert: true }
            );

            await savePlayerState(player, this.client);

            if (new247) {
                const disconnectTimeout = player.get('disconnectTimeout');
                if (disconnectTimeout) {
                    clearTimeout(disconnectTimeout);
                    player.set('disconnectTimeout', null);
                }
                
                const queueEndTimeout = player.get('queueEndTimeout');
                if (queueEndTimeout) {
                    clearTimeout(queueEndTimeout);
                    player.set('queueEndTimeout', null);
                }
            }

            const title = new247 ? `${emojis.misc.moon} 24/7 Mode Enabled` : `${emojis.misc.sun} 24/7 Mode Disabled`;
            const message = new247 
                ? "I'll stay in the voice channel even when the queue is empty."
                : "I'll leave the voice channel when the queue is empty.";

            return ctx.sendMessage({
                components: [this._buildContainer(title, message)],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[247] Error: ${error.message}`);
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Failed to toggle 24/7 mode: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
