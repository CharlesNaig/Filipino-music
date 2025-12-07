/**
 * Reassign Command
 * 
 * Allows bot owners to manually reassign a guild to a different bot.
 * Useful for load balancing or troubleshooting.
 */

import { ApplicationCommandOptionType, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import Command from '../../structures/Command.js';
import { botCluster, loadBalancer } from '../../orchestrator.js';
import emojis from '../../emojis.js';

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

    _buildContainer(title, message) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${title}\n${message}`)
        );
        return container;
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
                components: [this._buildContainer(`${emojis.status.error} Missing Argument`, `Please specify a target bot ID.\n\n**Available Bots:**\n${this._listBots()}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Validate bot exists
        const targetClient = botCluster.get(targetBotId);
        if (!targetClient) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Bot Not Found`, `Bot \`${targetBotId}\` does not exist.\n\n**Available Bots:**\n${this._listBots()}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Check if bot is online
        if (!targetClient.isReady()) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Bot Offline`, `Bot \`${targetBotId}\` (${targetClient.botName}) is currently offline.`)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Check if bot has Lavalink connected
        if (!targetClient.lavalink?.nodeManager?.nodes?.size) {
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.warning} Warning`, `Bot \`${targetBotId}\` (${targetClient.botName}) has no Lavalink connection.\nMusic features may not work.`)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            // Perform reassignment
            const result = await loadBalancer.forceAssign(guildId, targetBotId);

            if (!result.success) {
                return ctx.sendMessage({
                    components: [this._buildContainer(`${emojis.status.error} Reassignment Failed`, result.message)],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            // Build success container
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.status.success} Guild Reassigned`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Guild:** \`${guildId}\`\n` +
                    `**Assigned To:** ${targetClient.botName} (\`${targetBotId}\`)\n\n` +
                    `${emojis.status.info} The guild will now use this bot for music commands.`
                )
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**${emojis.misc.bot} Target Bot Status**\n` +
                    `**Status:** ${targetClient.isReady() ? `${emojis.status.success} Online` : `${emojis.status.error} Offline`}\n` +
                    `**Players:** ${targetClient.lavalink?.players?.size || 0}\n` +
                    `**Lavalink:** ${targetClient.lavalink?.nodeManager?.nodes?.size ? `${emojis.status.check} Connected` : `${emojis.status.error} Disconnected`}`
                )
            );

            // Note about active player
            const currentPlayer = this.client.lavalink?.getPlayer(guildId);
            if (currentPlayer) {
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${emojis.status.warning} Active Player**\n` +
                        `There's an active player in this guild.\n` +
                        `The player will continue on the current bot until stopped.\n` +
                        `New music commands will be handled by the new bot.`
                    )
                );
            }

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Requested by ${ctx.author.tag}`)
            );

            return ctx.sendMessage({ 
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            this.client.logger.error(`[Reassign] Error: ${error.message}`);
            
            return ctx.sendMessage({
                components: [this._buildContainer(`${emojis.status.error} Error`, `An error occurred while reassigning the guild.\n\`\`\`${error.message}\`\`\``)],
                flags: MessageFlags.IsComponentsV2
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
            const status = client.isReady() ? emojis.status.success : emojis.status.error;
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
