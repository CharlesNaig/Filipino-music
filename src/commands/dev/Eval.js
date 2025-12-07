import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import { inspect } from 'util';
import emojis from '../../emojis.js';

export default class Eval extends Command {
    constructor(client) {
        super(client, {
            name: 'eval',
            description: {
                content: 'Evaluates JavaScript code',
                usage: '<code>',
                examples: ['client.commands.size', 'client.guilds.cache.size'],
            },
            aliases: ['e'],
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

    _buildContainer(title, content, isError = false) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${title}`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`\`\`\`js\n${content}\n\`\`\``)
        );
        return container;
    }

    async run(ctx, args) {
        const code = args.join(' ');
        if (!code) {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.status.error} Error\nPlease provide code to evaluate!`)
            );
            return ctx.sendMessage({ 
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            let evaled = await eval(code);
            if (typeof evaled !== 'string') {
                evaled = inspect(evaled, { depth: 0 });
            }
            
            // Censor sensitive information
            if (evaled.includes(this.client.token)) {
                evaled = evaled.replace(new RegExp(this.client.token, 'g'), '[TOKEN CENSORED]');
            }
            if (this.client.config.mongourl && evaled.includes(this.client.config.mongourl)) {
                evaled = evaled.replace(new RegExp(this.client.config.mongourl, 'g'), '[MONGO_URL CENSORED]');
            }
            
            // Truncate if too long
            if (evaled.length > 1900) {
                evaled = evaled.substring(0, 1900) + '...';
            }
            
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.success} Eval Success`, evaled)],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (e) {
            console.error(e);
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.error} Eval Error`, e.message, true)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
