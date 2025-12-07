/**
 * Volume Command
 * 
 * Adjust the player volume.
 */

import Command from '../../structures/Command.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';

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
                    type: 4, // Integer
                    required: false,
                    min_value: 0,
                    max_value: 150,
                },
            ],
            category: 'music',
        });

        this.file = file;
    }

    async run(ctx, args) {
        // Check if user is in a voice channel
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({
                content: `\`❌\` You need to be in a voice channel!`,
            });
        }

        // Get player
        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player) {
            return ctx.sendMessage({
                content: `\`❌\` Nothing is playing right now!`,
            });
        }

        // Check if user is in the same voice channel
        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({
                content: `\`❌\` You need to be in the same voice channel as me!`,
            });
        }

        // Get volume level
        const volumeArg = ctx.isInteraction 
            ? ctx.interaction.options.getInteger('level')
            : parseInt(args[0]);

        // If no volume provided, show current volume
        if (volumeArg === null || volumeArg === undefined || isNaN(volumeArg)) {
            const volumeBar = this._createVolumeBar(player.volume);
            return ctx.sendMessage({
                content: `\`🔊\` Current volume: **${player.volume}%**\n${volumeBar}`,
            });
        }

        // Validate volume range
        if (volumeArg < 0 || volumeArg > 150) {
            return ctx.sendMessage({
                content: `\`❌\` Volume must be between 0 and 150!`,
            });
        }

        try {
            const oldVolume = player.volume;
            await player.setVolume(volumeArg);

            // Save player state
            await savePlayerState(player, this.client);

            const volumeBar = this._createVolumeBar(volumeArg);
            const emoji = volumeArg > oldVolume ? '🔊' : volumeArg < oldVolume ? '🔉' : '🔊';

            return ctx.sendMessage({
                content: `\`${emoji}\` Volume set to **${volumeArg}%**\n${volumeBar}`,
            });
        } catch (error) {
            this.client.logger.error(`[Volume] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to set volume: ${error.message}`,
            });
        }
    }

    _createVolumeBar(volume) {
        const filled = Math.round(volume / 10);
        const empty = 15 - filled;
        return '`' + '▓'.repeat(filled) + '░'.repeat(empty) + '`';
    }
}
