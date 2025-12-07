/**
 * Clear Command
 * 
 * Clear the entire queue.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Clear extends Command {
    constructor(client, file) {
        super(client, {
            name: 'clear',
            description: {
                content: 'Clear the entire queue',
                usage: 'clear',
                examples: ['clear'],
            },
            aliases: ['empty', 'clearqueue', 'cq'],
            cooldown: 5,
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

        if (player.queue.tracks.length === 0) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'The queue is already empty!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            const clearedCount = player.queue.tracks.length;
            player.queue.tracks = [];
            await savePlayerState(player, this.client);

            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.misc.trash} Queue Cleared`, `Cleared **${clearedCount}** track${clearedCount !== 1 ? 's' : ''} from the queue!`)],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[Clear] Error: ${error.message}`);
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Failed to clear queue: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
