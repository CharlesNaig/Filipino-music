/**
 * NowPlaying Command
 * 
 * Display the currently playing track.
 */

import Command from '../../structures/Command.js';
import { EmbedBuilder } from 'discord.js';
import { formatDuration, createProgressBar } from '../../managers/LavalinkHandler.js';

export default class NowPlaying extends Command {
    constructor(client, file) {
        super(client, {
            name: 'nowplaying',
            description: {
                content: 'Display the currently playing track',
                usage: 'nowplaying',
                examples: ['nowplaying'],
            },
            aliases: ['np', 'current', 'playing'],
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

    async run(ctx, args) {
        // Get player
        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({
                content: `\`❌\` Nothing is playing right now!`,
            });
        }

        const track = player.queue.current;
        const position = player.position;
        const duration = track.info.duration;

        // Build embed
        const embed = new EmbedBuilder()
            .setColor(this.client.config.color.default)
            .setAuthor({
                name: player.paused ? '⏸️ Paused' : '🎵 Now Playing',
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setTitle(track.info.title)
            .setURL(track.info.uri)
            .setThumbnail(track.info.artworkUrl || track.info.thumbnail || null);

        // Add artist
        embed.addFields({
            name: '`👤` Artist',
            value: track.info.author || 'Unknown',
            inline: true,
        });

        // Add duration/progress
        if (track.info.isStream) {
            embed.addFields({
                name: '`⏱️` Duration',
                value: '🔴 LIVE',
                inline: true,
            });
        } else {
            const progressBar = createProgressBar(position, duration, 12);
            embed.addFields({
                name: '`⏱️` Progress',
                value: `${formatDuration(position)} ${progressBar} ${formatDuration(duration)}`,
                inline: false,
            });
        }

        // Add volume
        embed.addFields({
            name: '`🔊` Volume',
            value: `${player.volume}%`,
            inline: true,
        });

        // Add loop mode
        if (player.repeatMode && player.repeatMode !== 'off') {
            embed.addFields({
                name: '`🔁` Loop',
                value: player.repeatMode === 'track' ? 'Track' : 'Queue',
                inline: true,
            });
        }

        // Add queue info
        const queueLength = player.queue.tracks.length;
        if (queueLength > 0) {
            embed.addFields({
                name: '`📜` Queue',
                value: `${queueLength} track${queueLength !== 1 ? 's' : ''} remaining`,
                inline: true,
            });
        }

        // Add requester
        const requester = track.requester;
        if (requester) {
            embed.setFooter({
                text: `Requested by ${requester.username || 'Unknown'}`,
                iconURL: requester.displayAvatarURL || null,
            });
        }

        embed.setTimestamp();

        return ctx.sendMessage({ embeds: [embed] });
    }
}
