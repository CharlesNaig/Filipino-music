import Command from "../../structures/Command.js";
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } from "discord.js";
import emojis from '../../emojis.js';

export default class Help extends Command {
    constructor(client) {
        super(client, {
            name: 'help',
            description: {
                content: 'Display all commands available to you.',
                usage: '[command]',
                examples: ['help', 'help ping'],
            },
            aliases: ['h', 'commands'],
            category: 'info',
            cooldown: 3,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: "command",
                    description: "Get info on a specific command",
                    type: 3,
                    required: false,
                },
            ]
        });
    }

    async run(ctx, args) {
        const cmdArg = ctx.isInteraction 
            ? ctx.interaction.options.getString('command')
            : args[0];

        if (cmdArg) {
            const command = this.client.commands.get(cmdArg.toLowerCase()) || 
                           this.client.commands.get(this.client.aliases.get(cmdArg.toLowerCase()));
            
            if (!command) {
                const container = new ContainerBuilder();
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${emojis.status.error} Error\nCommand \`${cmdArg}\` not found.`)
                );
                return ctx.sendMessage({ 
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            return ctx.sendMessage({ 
                components: [this._buildCommandContainer(command)],
                flags: MessageFlags.IsComponentsV2
            });
        }
        
        // Get categories
        const categories = this._getCategories();
        
        // Build main help container with dropdown
        const container = this._buildMainContainer(categories);
        
        const message = await ctx.sendMessage({ 
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        // Set up collector for dropdown
        if (message) {
            const collector = message.createMessageComponentCollector({
                filter: (i) => i.customId === 'help_category' && i.user.id === ctx.author.id,
                time: 120000,
            });

            collector.on('collect', async (interaction) => {
                const selected = interaction.values[0];
                
                if (selected === 'home') {
                    const homeContainer = this._buildMainContainer(categories);
                    await interaction.update({
                        components: [homeContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } else {
                    const categoryContainer = this._buildCategoryContainer(selected, categories);
                    await interaction.update({
                        components: [categoryContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            });

            collector.on('end', async () => {
                try {
                    const disabledContainer = this._buildMainContainer(categories, true);
                    await message.edit({
                        components: [disabledContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch (error) {
                    // Message may be deleted
                }
            });
        }
    }

    _getCategories() {
        const categories = {};

        this.client.commands.forEach(cmd => {
            const cat = cmd.category || 'other';
            if (!categories[cat]) {
                categories[cat] = {
                    emoji: emojis.categories[cat] || emojis.player.playlist,
                    commands: []
                };
            }
            categories[cat].commands.push(cmd);
        });

        return categories;
    }

    _buildMainContainer(categories, disabled = false) {
        const container = new ContainerBuilder();

        // Header
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emojis.misc.help} Help Menu`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Description
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `Welcome! Select a category below to view commands.\n` +
                `Use \`${this.client.config.prefix}help [command]\` for detailed info.`
            )
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Category overview
        const categoryList = Object.entries(categories).map(([name, data]) => {
            return `${data.emoji} **${name.charAt(0).toUpperCase() + name.slice(1)}** — ${data.commands.length} commands`;
        }).join('\n');

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(categoryList)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Dropdown menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder(`${emojis.player.playlist} Select a category...`)
            .setDisabled(disabled)
            .addOptions([
                {
                    label: 'Home',
                    description: 'Return to main help menu',
                    value: 'home',
                    emoji: emojis.misc.server
                },
                ...Object.entries(categories).map(([name, data]) => ({
                    label: name.charAt(0).toUpperCase() + name.slice(1),
                    description: `${data.commands.length} commands`,
                    value: name,
                    emoji: data.emoji
                }))
            ]);

        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Footer
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Total Commands: ${this.client.commands.size}`)
        );

        return container;
    }

    _buildCategoryContainer(categoryName, categories) {
        const category = categories[categoryName];
        const container = new ContainerBuilder();

        // Header
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${category.emoji} ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Commands`
            )
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Commands list
        const commandsList = category.commands.map(cmd => {
            const desc = cmd.description.content?.substring(0, 50) || 'No description';
            return `**\`${cmd.name}\`** — ${desc}${cmd.description.content?.length > 50 ? '...' : ''}`;
        }).join('\n');

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(commandsList)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Dropdown menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder(`${emojis.player.playlist} Select a category...`)
            .addOptions([
                {
                    label: 'Home',
                    description: 'Return to main help menu',
                    value: 'home',
                    emoji: emojis.misc.server
                },
                ...Object.entries(categories).map(([name, data]) => ({
                    label: name.charAt(0).toUpperCase() + name.slice(1),
                    description: `${data.commands.length} commands`,
                    value: name,
                    emoji: data.emoji,
                    default: name === categoryName
                }))
            ]);

        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Footer
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# ${category.commands.length} commands in this category`
            )
        );

        return container;
    }

    _buildCommandContainer(command) {
        const container = new ContainerBuilder();

        // Header
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emojis.misc.about} Command: ${command.name}`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Description
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(command.description.content || 'No description available.')
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Details
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${emojis.player.lyrics} **Usage:** \`${this.client.config.prefix}${command.name} ${command.description.usage || ''}\`\n` +
                `${emojis.misc.commands} **Aliases:** ${command.aliases?.length ? command.aliases.map(a => `\`${a}\``).join(', ') : 'None'}\n` +
                `${emojis.player.playlist} **Category:** ${command.category || 'None'}\n` +
                `${emojis.misc.clock} **Cooldown:** ${command.cooldown || 3}s`
            )
        );

        // Examples
        if (command.description.examples?.length) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${emojis.misc.star} **Examples:**\n${command.description.examples.map(ex => `\`${this.client.config.prefix}${ex}\``).join('\n')}`
                )
            );
        }

        return container;
    }
}
