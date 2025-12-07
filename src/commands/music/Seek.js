/**
 * Seek Command
 * 
 * Seek to a specific position in the current track.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Seek extends Command {
    constructor(client, file) {
        super(client, {
            name: 'seek',
            description: {
                content: 'Seek to a specific position in the current track',
                usage: 'seek <time>',
                examples: ['seek 1:30', 'seek 90', 'seek 2:30:00'],
            },
            aliases: ['goto', 'jumpto'],
            cooldown: 3,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'time',
                    description: 'Time to seek to (e.g., 1:30 or 90)',
                    type: 3,
                    required: true,
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

        if (!player || !player.queue.current) {
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

        const track = player.queue.current;
        if (track.info.isStream) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Cannot seek in a live stream!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const timeArg = ctx.isInteraction 
            ? ctx.interaction.options.getString('time')
            : args.join(' ');

        const position = this._parseTime(timeArg);
        if (position === null) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Invalid time format! Use: `1:30`, `90` (seconds), or `1:30:00`')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (position < 0) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Position cannot be negative!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (position >= track.info.duration) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Position exceeds track duration (${formatDuration(track.info.duration)})!`)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            await player.seek(position);

            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.player.forward} Seeked`, `Jumped to **${formatDuration(position)}**`)],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[Seek] Error: ${error.message}`);
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Failed to seek: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }

    _parseTime(timeStr) {
        if (!timeStr) return null;

        timeStr = timeStr.trim();

        if (/^\d+$/.test(timeStr)) {
            return parseInt(timeStr) * 1000;
        }

        const parts = timeStr.split(':').map(p => parseInt(p));
        
        if (parts.some(isNaN)) return null;

        if (parts.length === 2) {
            const [minutes, seconds] = parts;
            return (minutes * 60 + seconds) * 1000;
        } else if (parts.length === 3) {
            const [hours, minutes, seconds] = parts;
            return (hours * 3600 + minutes * 60 + seconds) * 1000;
        }

        return null;
    }
}
