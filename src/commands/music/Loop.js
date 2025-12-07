/**
 * Loop Command
 * 
 * Toggle loop mode (off/track/queue).
 */

import Command from '../../structures/Command.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';

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
                    type: 3, // String
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

        // Get mode argument
        let mode = ctx.isInteraction 
            ? ctx.interaction.options.getString('mode')
            : args[0]?.toLowerCase();

        // If no mode specified, cycle through modes
        if (!mode) {
            const modes = ['off', 'track', 'queue'];
            const currentIndex = modes.indexOf(player.repeatMode || 'off');
            mode = modes[(currentIndex + 1) % modes.length];
        }

        // Validate mode
        if (!['off', 'track', 'queue'].includes(mode)) {
            return ctx.sendMessage({
                content: `\`❌\` Invalid mode! Use: \`off\`, \`track\`, or \`queue\``,
            });
        }

        try {
            await player.setRepeatMode(mode);

            // Save player state
            await savePlayerState(player, this.client);

            const modeDescriptions = {
                off: '`🔁` Loop disabled',
                track: '`🔂` Now looping the current track',
                queue: '`🔁` Now looping the entire queue',
            };

            return ctx.sendMessage({
                content: modeDescriptions[mode],
            });
        } catch (error) {
            this.client.logger.error(`[Loop] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to set loop mode: ${error.message}`,
            });
        }
    }
}
