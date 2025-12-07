/**
 * Reassign Command
 * 
 * Allows bot owners to manually reassign a guild to a different bot.
 * Useful for load balancing or troubleshooting.
 */

import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import Command from '../../structures/Command.js';
import { botCluster, loadBalancer } from '../../orchestrator.js';

export default class Reassign extends Command {
    constructor(client, file) {
        super(client, file, {
            name: 'reassign',
            description: {
                content: 'Reassign a guild to a different bot in the cluster',
                usage: 'reassign <bot-id> [guild-id]',
                examples: ['reassign bot-2', 'reassign bot-1 123456789012345678'],
            },
            category: 'dev',
            aliases: ['switchbot', 'movebot'],
            cooldown: 10,
            args: true,
            permissions: {
                dev: true,
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'bot',
                    description: 'Target bot ID to assign (e.g., bot-1, bot-2)',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'guild',
                    description: 'Guild ID to reassign (defaults to current guild)',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
            ],
        });
    }

    async run(ctx, args) {
        const targetBotId = ctx.isInteraction
            ? ctx.interaction.options.getString('bot')
            : args[0];

        const guildId = ctx.isInteraction
            ? ctx.interaction.options.getString('guild') || ctx.guild.id
            : args[1] || ctx.guild.id;

        if (!targetBotId) {
            return ctx.sendMessage({
                embeds: [{
                    color: parseInt(this.client.config.color.error.replace('#', ''), 16),
                    title: `\`❌\` Missing Argument`,
                    description: `Please specify a target bot ID.\n\n**Available Bots:**\n${this._listBots()}`,
                    timestamp: new Date().toISOString(),
                }],
            });
        }

        // Validate bot exists
        const targetClient = botCluster.get(targetBotId);
        if (!targetClient) {
            return ctx.sendMessage({
                embeds: [{
                    color: parseInt(this.client.config.color.error.replace('#', ''), 16),
                    title: `\`❌\` Bot Not Found`,
                    description: `Bot \`${targetBotId}\` does not exist.\n\n**Available Bots:**\n${this._listBots()}`,
                    timestamp: new Date().toISOString(),
                }],
            });
        }

        // Check if bot is online
        if (!targetClient.isReady()) {
            return ctx.sendMessage({
                embeds: [{
                    color: parseInt(this.client.config.color.error.replace('#', ''), 16),
                    title: `\`❌\` Bot Offline`,
                    description: `Bot \`${targetBotId}\` (${targetClient.botName}) is currently offline.`,
                    timestamp: new Date().toISOString(),
                }],
            });
        }

        // Check if bot has Lavalink connected
        if (!targetClient.lavalink?.nodeManager?.nodes?.size) {
            return ctx.sendMessage({
                embeds: [{
                    color: parseInt(this.client.config.color.warn.replace('#', ''), 16),
                    title: `\`⚠️\` Warning`,
                    description: `Bot \`${targetBotId}\` (${targetClient.botName}) has no Lavalink connection.\nMusic features may not work.`,
                    timestamp: new Date().toISOString(),
                }],
            });
        }

        try {
            // Perform reassignment
            const result = await loadBalancer.forceAssign(guildId, targetBotId);

            if (!result.success) {
                return ctx.sendMessage({
                    embeds: [{
                        color: parseInt(this.client.config.color.error.replace('#', ''), 16),
                        title: `\`❌\` Reassignment Failed`,
                        description: result.message,
                        timestamp: new Date().toISOString(),
                    }],
                });
            }

            // Build success embed
            const embed = {
                color: parseInt(this.client.config.color.success.replace('#', ''), 16),
                title: `\`✅\` Guild Reassigned`,
                description: [
                    `**Guild:** \`${guildId}\``,
                    `**Assigned To:** ${targetClient.botName} (\`${targetBotId}\`)`,
                    ``,
                    `\`💡\` The guild will now use this bot for music commands.`,
                ].join('\n'),
                fields: [
                    {
                        name: `\`📊\` Target Bot Status`,
                        value: [
                            `**Status:** ${targetClient.isReady() ? '`🟢` Online' : '`🔴` Offline'}`,
                            `**Players:** ${targetClient.lavalink?.players?.size || 0}`,
                            `**Lavalink:** ${targetClient.lavalink?.nodeManager?.nodes?.size ? '`✓` Connected' : '`✗` Disconnected'}`,
                        ].join('\n'),
                        inline: true,
                    },
                ],
                footer: {
                    text: `Requested by ${ctx.author.tag}`,
                    icon_url: ctx.author.displayAvatarURL(),
                },
                timestamp: new Date().toISOString(),
            };

            // Note about active player
            const currentPlayer = this.client.lavalink?.getPlayer(guildId);
            if (currentPlayer) {
                embed.fields.push({
                    name: `\`⚠️\` Active Player`,
                    value: [
                        `There's an active player in this guild.`,
                        `The player will continue on the current bot until stopped.`,
                        `New music commands will be handled by the new bot.`,
                    ].join('\n'),
                    inline: false,
                });
            }

            return ctx.sendMessage({ embeds: [embed] });

        } catch (error) {
            this.client.logger.error(`[Reassign] Error: ${error.message}`);
            
            return ctx.sendMessage({
                embeds: [{
                    color: parseInt(this.client.config.color.error.replace('#', ''), 16),
                    title: `\`❌\` Error`,
                    description: `An error occurred while reassigning the guild.\n\`\`\`${error.message}\`\`\``,
                    timestamp: new Date().toISOString(),
                }],
            });
        }
    }

    /**
     * List available bots
     * @private
     */
    _listBots() {
        const lines = [];
        for (const [botId, client] of botCluster) {
            const status = client.isReady() ? '🟢' : '🔴';
            const main = client.isMainBot ? ' (Main)' : '';
            lines.push(`${status} \`${botId}\` - ${client.botName}${main}`);
        }
        return lines.join('\n') || 'No bots available';
    }

    /**
     * Handle autocomplete for bot selection
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        const choices = [];
        for (const [botId, client] of botCluster) {
            const status = client.isReady() ? '🟢' : '🔴';
            const main = client.isMainBot ? ' (Main)' : '';
            choices.push({
                name: `${status} ${client.botName}${main} - ${botId}`,
                value: botId,
            });
        }

        const filtered = choices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue) ||
            choice.value.toLowerCase().includes(focusedValue)
        );

        await interaction.respond(filtered.slice(0, 25));
    }
}
