/**
 * Join Command - Make the bot join your voice channel
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { getPlayerOptions } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Join extends Command {
    constructor(client, file) {
        super(client, {
            name: 'join',
            description: {
                content: 'Make the bot join your voice channel',
                usage: 'join',
                examples: ['join'],
            },
            aliases: ['connect', 'summon', 'j'],
            cooldown: 3,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'Connect', 'Speak'],
                user: [],
            },
            slashCommand: true,
            options: [],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx) {
        const member = ctx.guild.members.cache.get(ctx.author.id);
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in a voice channel!` });
        }

        let player = this.client.lavalink?.players.get(ctx.guild.id);

        if (player && player.voiceChannelId === voiceChannel.id) {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.status.error} Error\nI'm already in your voice channel!`)
            );
            return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (player) {
            // Move to new channel
            await player.setVoiceChannel(voiceChannel.id);
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.misc.speaker} Moved\nMoved to **${voiceChannel.name}**`)
            );
            return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // Create new player
        const playerOptions = getPlayerOptions({
            guildId: ctx.guild.id,
            voiceChannelId: voiceChannel.id,
            textChannelId: ctx.channel.id,
        }, this.client.config);

        player = await this.client.lavalink.createPlayer(playerOptions);
        await player.connect();

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emojis.misc.speaker} Joined\nConnected to **${voiceChannel.name}**`)
        );
        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
