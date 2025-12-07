/**
 * ClusterStats Command
 * 
 * View detailed cluster statistics.
 * Developer only command.
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import BotStatus from '../../schemas/BotStatus.js';
import GuildAssignment from '../../schemas/GuildAssignment.js';
import PlayerSchema from '../../schemas/Player.js';
import emojis from '../../emojis.js';

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
        await ctx.sendDeferMessage({ content: `\`${emojis.status.loading}\` Gathering cluster statistics...` });

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

            const container = new ContainerBuilder();

            // Header
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${emojis.status.info} Cluster Statistics`)
            );

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // Bot Cluster stats
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${emojis.misc.bot} Bot Cluster\n` +
                    `**Online Bots:** ${onlineBots}/${botStatuses.length}\n` +
                    `**Total Guilds:** ${totalGuilds.toLocaleString()}\n` +
                    `**Total Players:** ${totalPlayers}\n` +
                    `**Active Assignments:** ${activeAssignments}\n` +
                    `**Saved Players (DB):** ${activePlayers}`
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // Lavalink stats
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${emojis.player.music} Lavalink\n` +
                    `**Connected Bots:** ${lavalinkConnected}/${botStatuses.length}\n` +
                    `**Nodes Configured:** ${this.client.config.lavalink?.nodes?.length || 0}\n` +
                    `**Active Players:** ${totalPlayers}\n` +
                    `**Strategy:** ${this.client.config.loadBalancing?.strategy || 'priority'}`
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // Memory stats
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${emojis.misc.memory} Memory\n` +
                    `**Total (Bots):** ${totalMemory}MB\n` +
                    `**Heap Used:** ${heapUsed}MB / ${heapTotal}MB\n` +
                    `**RSS:** ${rss}MB`
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // System info
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${emojis.misc.settings} System\n` +
                    `**Node.js:** ${nodeVersion}\n` +
                    `**Platform:** ${platform} (${arch})\n` +
                    `**Process Uptime:** ${this._formatUptime(uptime * 1000)}`
                )
            );

            // Per-bot breakdown
            if (botStatuses.length > 0) {
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                const botBreakdown = botStatuses.map(bot => {
                    const isOnline = bot.status !== 'Offline' && 
                        (Date.now() - new Date(bot.lastHeartbeat).getTime()) < 60000;
                    const emoji = isOnline ? emojis.status.success : emojis.status.error;
                    const main = bot.isMain ? ' [M]' : '';
                    return `${emoji} **${bot.name}${main}:** ${bot.playerCount || 0}p / ${bot.guildCount || 0}g`;
                }).join('\n');

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### ${emojis.misc.star} Bot Breakdown\n${botBreakdown || 'No data'}`
                    )
                );
            }

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // Footer
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Requested by ${ctx.author.tag}`)
            );

            return ctx.editMessage({ 
                content: null, 
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            this.client.logger.error(`[ClusterStats] Error: ${error.message}`);
            return ctx.editMessage({
                content: `\`${emojis.status.error}\` Failed to fetch cluster stats: ${error.message}`,
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
