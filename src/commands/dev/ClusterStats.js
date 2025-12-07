/**
 * ClusterStats Command
 * 
 * View detailed cluster statistics.
 * Developer only command.
 */

import Command from '../../structures/Command.js';
import { EmbedBuilder } from 'discord.js';
import BotStatus from '../../schemas/BotStatus.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';
import PlayerSchema from '../../schemas/Player.js';

export default class ClusterStats extends Command {
    constructor(client, file) {
        super(client, {
            name: 'clusterstats',
            description: {
                content: 'View detailed cluster statistics',
                usage: 'clusterstats',
                examples: ['clusterstats'],
            },
            aliases: ['cs', 'clusterinfo'],
            cooldown: 10,
            args: false,
            permissions: {
                dev: true, // Developer only
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [],
            category: 'dev',
        });

        this.file = file;
    }

    async run(ctx, args) {
        await ctx.sendDeferMessage({ content: `\`⏳\` Gathering cluster statistics...` });

        try {
            // Gather all stats in parallel
            const [botStatuses, activeAssignments, activePlayers] = await Promise.all([
                BotStatus.find({}),
                GuildAssignment.countDocuments({ isActive: true }),
                PlayerSchema.countDocuments({ destroyed: false }),
            ]);

            // Calculate totals
            let totalPlayers = 0;
            let totalGuilds = 0;
            let totalMemory = 0;
            let onlineBots = 0;
            let lavalinkConnected = 0;

            for (const bot of botStatuses) {
                const isOnline = bot.status !== 'Offline' && 
                    (Date.now() - new Date(bot.lastHeartbeat).getTime()) < 60000;

                if (isOnline) onlineBots++;
                if (bot.lavalinkConnected) lavalinkConnected++;
                totalPlayers += bot.playerCount || 0;
                totalGuilds += bot.guildCount || 0;
                totalMemory += bot.memoryUsage || 0;
            }

            // Get process stats
            const processMemory = process.memoryUsage();
            const heapUsed = Math.round(processMemory.heapUsed / 1024 / 1024);
            const heapTotal = Math.round(processMemory.heapTotal / 1024 / 1024);
            const rss = Math.round(processMemory.rss / 1024 / 1024);

            // Get Node.js info
            const nodeVersion = process.version;
            const platform = process.platform;
            const arch = process.arch;
            const uptime = process.uptime();

            const embed = new EmbedBuilder()
                .setColor(this.client.config.color.default)
                .setTitle('`📊` Cluster Statistics')
                .setTimestamp();

            // Bot stats
            embed.addFields({
                name: '`🤖` Bot Cluster',
                value: [
                    `**Online Bots:** ${onlineBots}/${botStatuses.length}`,
                    `**Total Guilds:** ${totalGuilds.toLocaleString()}`,
                    `**Total Players:** ${totalPlayers}`,
                    `**Active Assignments:** ${activeAssignments}`,
                    `**Saved Players (DB):** ${activePlayers}`,
                ].join('\n'),
                inline: true,
            });

            // Lavalink stats
            embed.addFields({
                name: '`🎵` Lavalink',
                value: [
                    `**Connected Bots:** ${lavalinkConnected}/${botStatuses.length}`,
                    `**Nodes Configured:** ${this.client.config.lavalink?.nodes?.length || 0}`,
                    `**Active Players:** ${totalPlayers}`,
                    `**Strategy:** ${this.client.config.loadBalancing?.strategy || 'priority'}`,
                ].join('\n'),
                inline: true,
            });

            // Memory stats
            embed.addFields({
                name: '`💾` Memory',
                value: [
                    `**Total (Bots):** ${totalMemory}MB`,
                    `**Heap Used:** ${heapUsed}MB / ${heapTotal}MB`,
                    `**RSS:** ${rss}MB`,
                ].join('\n'),
                inline: true,
            });

            // System info
            embed.addFields({
                name: '`⚙️` System',
                value: [
                    `**Node.js:** ${nodeVersion}`,
                    `**Platform:** ${platform} (${arch})`,
                    `**Process Uptime:** ${this._formatUptime(uptime * 1000)}`,
                ].join('\n'),
                inline: true,
            });

            // Per-bot breakdown
            if (botStatuses.length > 0) {
                const botBreakdown = botStatuses.map(bot => {
                    const isOnline = bot.status !== 'Offline' && 
                        (Date.now() - new Date(bot.lastHeartbeat).getTime()) < 60000;
                    const emoji = isOnline ? '🟢' : '🔴';
                    const main = bot.isMain ? ' [M]' : '';
                    return `${emoji} **${bot.name}${main}:** ${bot.playerCount || 0}p / ${bot.guildCount || 0}g`;
                }).join('\n');

                embed.addFields({
                    name: '`📈` Bot Breakdown',
                    value: botBreakdown || 'No data',
                    inline: false,
                });
            }

            embed.setFooter({
                text: `Requested by ${ctx.author.tag}`,
                iconURL: ctx.author.displayAvatarURL(),
            });

            return ctx.editMessage({ content: null, embeds: [embed] });
        } catch (error) {
            this.client.logger.error(`[ClusterStats] Error: ${error.message}`);
            return ctx.editMessage({
                content: `\`❌\` Failed to fetch cluster stats: ${error.message}`,
            });
        }
    }

    _formatUptime(ms) {
        if (!ms) return '0s';
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}
