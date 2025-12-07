/**
 * Playlist Append Command
 * Add current playing track to an existing playlist
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import Playlist from '../../schemas/Playlist.js';
import emojis from '../../emojis.js';

export default class PlaylistAppend extends Command {
    constructor(client, file) {
        super(client, {
            name: 'playlist-append',
            description: {
                content: 'Add the current track to an existing playlist',
                usage: 'playlist-append <playlist name>',
                examples: ['playlist-append My Favorites'],
            },
            aliases: ['plappend', 'pl-append', 'pladd'],
            cooldown: 3,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'playlist',
                    description: 'Name of the playlist to add to',
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
            ? ctx.interaction.options.getString('playlist')
            : args.join(' ');

        const playlist = await Playlist.findByName(ctx.author.id, name);
        
        if (!playlist) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Playlist "${name}" not found!` });
        }

        const track = player.queue.current;
        const result = await playlist.addTrack({
            title: track.info.title,
            author: track.info.author,
            uri: track.info.uri,
            duration: track.info.duration,
            artworkUrl: track.info.artworkUrl
        });
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                result.success 
                    ? `### ${emojis.misc.add} Track Added\n**${track.info.title}**\n\nAdded to **${playlist.name}**`
                    : `### ${emojis.status.error} Error\n${result.message}`
            )
        );

        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
