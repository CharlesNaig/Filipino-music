/**
 * Loop Command
 * 
 * Toggle loop mode (off/track/queue).
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';
import emojis from '../../emojis.js';

export default class Loop extends Command {
    constructor(client, file) {
        super(client, {
            name: 'loop',
            description: {
                content: 'Toggle loop mode (off/track/queue)',
                usage: 'loop [mode]',
                examples: ['loop', 'loop track', 'loop queue', 'loop off'],
            },
            aliases: ['repeat', 'l'],
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
                    name: 'mode',
                    description: 'Loop mode',
                    type: 3,
                    required: false,
                    choices: [
                        { name: 'Off', value: 'off' },
                        { name: 'Track', value: 'track' },
                        { name: 'Queue', value: 'queue' },
                    ],
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

        let mode = ctx.isInteraction 
            ? ctx.interaction.options.getString('mode')
            : args[0]?.toLowerCase();

        if (!mode) {
            const modes = ['off', 'track', 'queue'];
            const currentIndex = modes.indexOf(player.repeatMode || 'off');
            mode = modes[(currentIndex + 1) % modes.length];
        }

        if (!['off', 'track', 'queue'].includes(mode)) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Invalid mode! Use: `off`, `track`, or `queue`')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            await player.setRepeatMode(mode);
            await savePlayerState(player, this.client);

            const modeInfo = {
                off: { title: `${emojis.player.loop} Loop Disabled`, message: 'Loop mode has been turned off.' },
                track: { title: `${emojis.player.loopTrack} Track Loop`, message: 'Now looping the current track.' },
                queue: { title: `${emojis.player.loop} Queue Loop`, message: 'Now looping the entire queue.' },
            };

            return ctx.sendMessage({
                components: [this._buildContainer(modeInfo[mode].title, modeInfo[mode].message)],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[Loop] Error: ${error.message}`);
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `Failed to set loop mode: ${error.message}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
