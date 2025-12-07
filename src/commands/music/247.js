/**
 * 24/7 Command
 * 
 * Toggle 24/7 mode (stay in voice channel when queue is empty).
 */

import Command from '../../structures/Command.js';
import { savePlayerState } from '../../managers/LavalinkHandler.js';
import Schema247 from '../../schemas/247.js';

export default class TwentyFourSeven extends Command {
    constructor(client, file) {
        super(client, {
            name: '247',
            description: {
                content: 'Toggle 24/7 mode (stay in voice channel when queue is empty)',
                usage: '247',
                examples: ['247'],
            },
            aliases: ['twentyfourseven', '24-7', 'stay'],
            cooldown: 5,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: ['ManageGuild'], // Require Manage Guild permission
            },
            slashCommand: true,
            options: [],
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
                content: `\`❌\` Nothing is playing right now! Start playing music first.`,
            });
        }

        // Check if user is in the same voice channel
        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({
                content: `\`❌\` You need to be in the same voice channel as me!`,
            });
        }

        try {
            // Toggle 24/7 mode
            const current247 = player.get('twentyFourSeven') || false;
            const new247 = !current247;

            player.set('twentyFourSeven', new247);

            // Save to database for persistence
            await Schema247.findOneAndUpdate(
                { _id: ctx.guild.id },
                { 
                    enabled: new247,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: ctx.channel.id,
                },
                { upsert: true }
            );

            // Save player state
            await savePlayerState(player, this.client);

            // Cancel any pending disconnect timeout
            if (new247) {
                const disconnectTimeout = player.get('disconnectTimeout');
                if (disconnectTimeout) {
                    clearTimeout(disconnectTimeout);
                    player.set('disconnectTimeout', null);
                }
                
                const queueEndTimeout = player.get('queueEndTimeout');
                if (queueEndTimeout) {
                    clearTimeout(queueEndTimeout);
                    player.set('queueEndTimeout', null);
                }
            }

            return ctx.sendMessage({
                content: new247 
                    ? `\`🌙\` **24/7 mode enabled!** I'll stay in the voice channel even when the queue is empty.`
                    : `\`☀️\` **24/7 mode disabled!** I'll leave the voice channel when the queue is empty.`,
            });
        } catch (error) {
            this.client.logger.error(`[247] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to toggle 24/7 mode: ${error.message}`,
            });
        }
    }
}
