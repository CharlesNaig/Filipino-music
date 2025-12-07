/**
 * BotStatus Command
 * 
 * View the status of all bots in the cluster.
 * Developer only command.
 */

import Command from '../../structures/Command.js';
import { EmbedBuilder } from 'discord.js';
import BotStatus from '../../schemas/BotStatus.js';

export default class BotStatusCommand extends Command {
    constructor(client, file) {
        super(client, {
            name: 'botstatus',
            description: {
                content: 'View the status of all bots in the cluster',
                usage: 'botstatus',
                examples: ['botstatus'],
            },
            aliases: ['bs', 'bots', 'cluster'],
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
        try {
            // Fetch all bot statuses from database
            const botStatuses = await BotStatus.find({}).sort({ _id: 1 });

            if (botStatuses.length === 0) {
                return ctx.sendMessage({
                    content: `\`❌\` No bot status data found. Is the orchestrator running?`,
                });
            }

            const embed = new EmbedBuilder()
                .setColor(this.client.config.color.default)
                .setTitle('`🤖` Bot Cluster Status')
                .setDescription('Current status of all bots in the cluster')
                .setTimestamp();

            let totalPlayers = 0;
            let totalGuilds = 0;
            let onlineBots = 0;

            for (const bot of botStatuses) {
                const isOnline = bot.status !== 'Offline' && 
                    (Date.now() - new Date(bot.lastHeartbeat).getTime()) < 60000;

                if (isOnline) onlineBots++;
                totalPlayers += bot.playerCount || 0;
                totalGuilds += bot.guildCount || 0;

                const statusEmoji = this._getStatusEmoji(bot.status, isOnline);
                const mainTag = bot.isMain ? ' `[MAIN]`' : '';
                const lavalinkStatus = bot.lavalinkConnected ? '`✓`' : '`✗`';

                const uptimeStr = this._formatUptime(bot.uptime);
                const lastSeen = isOnline ? 'Now' : this._formatTimeAgo(bot.lastHeartbeat);

                embed.addFields({
                    name: `${statusEmoji} ${bot.name}${mainTag}`,
                    value: [
                        `**Status:** ${bot.status}`,
                        `**Players:** ${bot.playerCount || 0} | **Guilds:** ${bot.guildCount || 0}`,
                        `**Lavalink:** ${lavalinkStatus} | **Ping:** ${bot.ping || 0}ms`,
                        `**Memory:** ${bot.memoryUsage || 0}MB | **Uptime:** ${uptimeStr}`,
                        `**Last Seen:** ${lastSeen}`,
                    ].join('\n'),
                    inline: true,
                });
            }

            // Add summary
            embed.addFields({
                name: '📊 Cluster Summary',
                value: [
                    `**Online Bots:** ${onlineBots}/${botStatuses.length}`,
                    `**Total Players:** ${totalPlayers}`,
                    `**Total Guilds:** ${totalGuilds}`,
                ].join('\n'),
                inline: false,
            });

            embed.setFooter({
                text: `Requested by ${ctx.author.tag}`,
                iconURL: ctx.author.displayAvatarURL(),
            });

            return ctx.sendMessage({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error(`[BotStatus] Error: ${error.message}`);
            return ctx.sendMessage({
                content: `\`❌\` Failed to fetch bot status: ${error.message}`,
            });
        }
    }

    _getStatusEmoji(status, isOnline) {
        if (!isOnline) return '🔴';
        switch (status) {
            case 'Available': return '🟢';
            case 'InUse': return '🟡';
            case 'Offline': return '🔴';
            case 'Error': return '🔴';
            default: return '⚪';
        }
    }

    _formatUptime(ms) {
        if (!ms) return '0s';
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    _formatTimeAgo(date) {
        const diff = Date.now() - new Date(date).getTime();
        const seconds = Math.floor(diff / 1000);
        
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}
