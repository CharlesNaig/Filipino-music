import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

export default class LeaveGuild extends Command {
    constructor(client) {
        super(client, {
            name: 'leave-guild',
            description: {
                content: 'Leave a guild',
                usage: '<server id>',
                examples: ['leave-guild 123456789'],
            },
            aliases: ['gleave'],
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
        const guild = this.client.guilds.cache.get(args.join(" "));

        if (!guild) {
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Guild not found.')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const guildName = guild.name;
        await guild.leave();
        
        return ctx.sendMessage({ 
            components: [this._buildContainer(`${emojis.status.success} Left Guild`, `Left guild: **${guildName}**`)],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
