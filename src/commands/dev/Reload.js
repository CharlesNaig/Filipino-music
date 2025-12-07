import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class Reload extends Command {
    constructor(client) {
        super(client, {
            name: 'reload',
            description: {
                content: 'Reload a command',
                usage: '<command name>',
                examples: ['reload ping', 'reload help'],
            },
            aliases: ['r'],
            category: 'dev',
            cooldown: 3,
            args: true,
            permissions: {
                dev: true,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: false,
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
        const commandName = args[0].toLowerCase();
        const command = this.client.commands.get(commandName) || 
                       this.client.commands.get(this.client.aliases.get(commandName));
        
        if (!command) {
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.error} Error`, `Command \`${commandName}\` not found.`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
        
        try {
            // Remove from cache
            this.client.commands.delete(command.name);
            if (command.aliases && command.aliases.length) {
                command.aliases.forEach(alias => this.client.aliases.delete(alias));
            }
            
            // Re-import the command
            const timestamp = Date.now();
            const CommandClass = (await import(`../${command.category}/${command.fileName}.js?update=${timestamp}`)).default;
            const newCommand = new CommandClass(this.client);
            
            // Re-register
            this.client.commands.set(newCommand.name, newCommand);
            if (newCommand.aliases && newCommand.aliases.length) {
                newCommand.aliases.forEach(alias => {
                    this.client.aliases.set(alias, newCommand.name);
                });
            }
            
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.success} Reloaded`, `Successfully reloaded command: \`${newCommand.name}\``)],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error(error);
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.status.error} Error`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`Error reloading command: \`${commandName}\`\n\`\`\`js\n${error.message}\n\`\`\``)
            );
            return ctx.sendMessage({ 
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
