/**
 * Seek Command
 * 
 * Seek to a specific position in the current track.
 */

import Command from '../../structures/Command.js';
import { formatDuration } from '../../managers/LavalinkHandler.js';

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
                    type: 3, // String
                    required: true,
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

        if (!player || !player.queue.current) {
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

        // Check if track is seekable
        const track = player.queue.current;
        if (track.info.isStream) {
            return ctx.sendMessage({
                content: `\`❌\` Cannot seek in a live stream!`,
            });
        }

        // Get time argument
        const timeArg = ctx.isInteraction 
            ? ctx.interaction.options.getString('time')
            : args.join(' ');

        // Parse time
        const position = this._parseTime(timeArg);
        if (position === null) {
            return ctx.sendMessage({
                content: `\`❌\` Invalid time format! Use: \`1:30\`, \`90\` (seconds), or \`1:30:00\``,
            });
        }

        // Validate position
        if (position < 0) {
            return ctx.sendMessage({
                content: `\`❌\` Position cannot be negative!`,
            });
        }

        if (position >= track.info.duration) {
            return ctx.sendMessage({
                content: `\`❌\` Position exceeds track duration (${formatDuration(track.info.duration)})!`,
            });
        }

        try {
            await player.seek(position);

            return ctx.sendMessage({
                content: `\`⏩\` Seeked to **${formatDuration(position)}**`,
            });
        } catch (error) {
            this.client.logger.error(`[Seek] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to seek: ${error.message}`,
            });
        }
    }

    /**
     * Parse time string to milliseconds
     * Supports: "1:30", "90", "1:30:00"
     */
    _parseTime(timeStr) {
        if (!timeStr) return null;

        timeStr = timeStr.trim();

        // Check if it's just a number (seconds)
        if (/^\d+$/.test(timeStr)) {
            return parseInt(timeStr) * 1000;
        }

        // Check for time format (MM:SS or HH:MM:SS)
        const parts = timeStr.split(':').map(p => parseInt(p));
        
        if (parts.some(isNaN)) return null;

        if (parts.length === 2) {
            // MM:SS
            const [minutes, seconds] = parts;
            return (minutes * 60 + seconds) * 1000;
        } else if (parts.length === 3) {
            // HH:MM:SS
            const [hours, minutes, seconds] = parts;
            return (hours * 3600 + minutes * 60 + seconds) * 1000;
        }

        return null;
    }
}
