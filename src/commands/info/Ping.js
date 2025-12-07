import Command from "../../structures/Command.js"; 
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from "discord.js";
import emojis from '../../emojis.js';

export default class Ping extends Command {
    constructor(client) {
        super(client, {
            name: 'ping',
            description: {
                content: 'Check the bot\'s latency and response time.',
                usage: 'ping',
                examples: ['ping'],
            },
            category: 'info',
            cooldown: 3,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
        });
    }

    async run(ctx, args) {
        const searchContainer = new ContainerBuilder();
        searchContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emojis.misc.ping} Pinging...`)
        );

        const msg = await ctx.sendDeferMessage({ 
            components: [searchContainer],
            flags: MessageFlags.IsComponentsV2
        });

        const botLatency = msg.createdTimestamp - ctx.createdTimestamp;
        const apiLatency = Math.round(ctx.client.ws.ping);

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emojis.misc.ping} Pong!`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${emojis.misc.bot} **Bot Latency:** \`${botLatency}ms\`\n` +
                `${emojis.misc.link} **API Latency:** \`${apiLatency}ms\``
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Requested by ${ctx.author.tag}`)
        );

        return await ctx.editMessage({ 
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
