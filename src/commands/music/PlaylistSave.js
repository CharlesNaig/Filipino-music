/**
 * Playlist Save Command
 * Save current queue to a new playlist
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistSave extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-save',
            description: {
                content: 'Save the current queue as a new playlist',
                usage: 'playlist-save <name>',
                examples: ['playlist-save My Queue'],
            },
            aliases: ['plsave', 'pl-save', 'savequeue'],
            cooldown: 5,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'name',
                    description: 'Name for the new playlist',
                    type: 3,
                    required: true,
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in a voice channel!` });
        }

        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Nothing is playing right now!` });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!` });
        }

        const name = ctx.isInteraction 
            ? ctx.interaction.options.getString('name')
            : args.join(' ');

        if (name.length > 50) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist name must be 50 characters or less!` });
        }

        // Create playlist
        const result = await Playlist.createPlaylist(ctx.author.id, name);
        
        if (!result.success) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` ${result.message}` });
        }

        const playlist = result.playlist;

        // Add current track
        const current = player.queue.current;
        await playlist.addTrack({
            title: current.info.title,
            author: current.info.author,
            uri: current.info.uri,
            duration: current.info.duration,
            artworkUrl: current.info.artworkUrl
        });

        // Add queue tracks
        for (const track of player.queue.tracks) {
            await playlist.addTrack({
                title: track.info.title,
                author: track.info.author,
                uri: track.info.uri,
                duration: track.info.duration,
                artworkUrl: track.info.artworkUrl
            });
        }

        const totalTracks = 1 + player.queue.tracks.length;
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.misc.save} Queue Saved\n**${name}**\n\nSaved **${totalTracks}** tracks to playlist!`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
