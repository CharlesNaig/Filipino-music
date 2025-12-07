/**
 * Stop Command
 * 
 * Stop playback, clear the queue, and disconnect.
 */

import Command from '../../structures/Command.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';
import PlayerSchema from '../../schemas/Player.js';

export default class Stop extends Command {
    constructor(client, file) {
        super(client, {
            name: 'stop',
            description: {
                content: 'Stop playback, clear the queue, and disconnect',
                usage: 'stop',
                examples: ['stop'],
            },
            aliases: ['dc', 'disconnect', 'leave'],
            cooldown: 3,
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

        try {
            // Destroy player
            await player.destroy();

            // Mark player as destroyed in database
            await PlayerSchema.markDestroyed(ctx.guild.id);

            // Deactivate assignment
            const assignment = await GuildAssignment.findById(ctx.guild.id);
            if (assignment) {
                await assignment.deactivate();
            }

            return ctx.sendMessage({
                content: `\`⏹️\` Stopped playback and disconnected. Thanks for listening!`,
            });
        } catch (error) {
            this.client.logger.error(`[Stop] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to stop: ${error.message}`,
            });
        }
    }
}
