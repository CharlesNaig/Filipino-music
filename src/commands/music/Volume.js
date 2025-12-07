/**
 * Volume Command
 * 
 * Adjust the player volume.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Volume extends Command {
    constructor(client, file) {
        super(client, {
            name: 'volume',
            description: {
                content: 'Adjust the player volume (0-150)',
                usage: 'volume <0-150>',
                examples: ['volume 80', 'volume 50'],
            },
            aliases: ['vol', 'v'],
            cooldown: 3,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'level',
                    description: 'Volume level (0-150)',
                    type: 4,
                    required: false,
                    min_value: 0,
                    max_value: 150,
                },
            ],
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

    _buildVolumeContainer(volume, changed = false) {
        const container = new ContainerBuilder();
        const volumeBar = this._createVolumeBar(volume);
        const emoji = volume > 100 ? emojis.player.volume : volume > 50 ? emojis.player.volumeMedium : volume > 0 ? emojis.player.volumeLow : emojis.player.volumeMute;
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emoji} Volume ${changed ? 'Set' : 'Current'}`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${volume}%**\n${volumeBar}`)
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

        const volumeArg = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('level')
            : parseInt(args[0]);

        if (volumeArg === null || volumeArg === undefined || isNaN(volumeArg)) {
            return ctx.sendMessage({
                components: [this._buildVolumeContainer(player.volume, false)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (volumeArg < 0 || volumeArg > 150) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Volume must be between 0 and 150!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            await player.setVolume(volumeArg);
            await savePlayerState(player, this.client);

            return ctx.sendMessage({
                components: [this._buildVolumeContainer(volumeArg, true)],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[Volume] Error: ${error.message}`);
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Failed to set volume: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }

    _createVolumeBar(volume) {
        const filled = Math.round(volume / 10);
        const empty = 15 - filled;
        return '`' + '▓'.repeat(Math.min(filled, 15)) + '░'.repeat(Math.max(empty, 0)) + '`';
    }
}
