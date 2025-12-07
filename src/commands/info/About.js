import Command from "../../structures/Command.js"; 
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } from "discord.js";
import emojis from '../../emojis.js';

export default class About extends Command {
    constructor(client) {
        super(client, {
            name: 'about',
            description: {
                content: 'See information about this bot.',
                usage: 'about',
                examples: ['about'],
            },
            aliases: ["info", "botinfo"],
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
        const container = new ContainerBuilder();

        // Header section with thumbnail
        const headerSection = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## Bot Information\n**${this.client.user.tag}**`)
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder().setURL(this.client.user.displayAvatarURL())
            );
        container.addSectionComponents(headerSection);

        // Separator
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Stats section
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${emojis.misc.server} **Servers:** ${this.client.guilds.cache.size}\n` +
                `${emojis.misc.user} **Users:** ${this.client.users.cache.size}\n` +
                `${emojis.misc.commands} **Commands:** ${this.client.commands.size}`
            )
        );

        // Separator
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Technical info
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${emojis.misc.ping} **Ping:** ${Math.round(this.client.ws.ping)}ms\n` +
                `${emojis.misc.uptime} **Uptime:** <t:${Math.floor((Date.now() - this.client.uptime) / 1000)}:R>\n` +
                `${emojis.misc.cpu} **Node.js:** ${process.version}\n` +
                `${emojis.misc.about} **Discord.js:** v14.22.1\n` +
                `${emojis.misc.settings} **Prefix:** ${this.client.config.prefix}`
            )
        );

        // Separator
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Footer
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Requested by ${ctx.author.tag}`)
        );

        return await ctx.sendMessage({ 
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
