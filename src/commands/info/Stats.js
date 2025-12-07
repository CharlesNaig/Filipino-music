import Command from "../../structures/Command.js";
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from "discord.js";
import { version } from 'discord.js';
import os from 'os';

export default class Stats extends Command {
    constructor(client) {
        super(client, {
            name: 'stats',
            description: {
                content: 'Display bot statistics.',
                usage: 'stats',
                examples: ['stats'],
            },
            aliases: ['statistics', 'botstat'],
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
        const totalSeconds = Math.floor(this.client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const seconds = totalSeconds % 60;
        
        const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMemory = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        
        const container = new ContainerBuilder();
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 📊 Bot Statistics`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        // Bot Information
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🤖 Bot Information\n` +
                `**Servers:** ${this.client.guilds.cache.size}\n` +
                `**Users:** ${this.client.users.cache.size}\n` +
                `**Channels:** ${this.client.channels.cache.size}\n` +
                `**Commands:** ${this.client.commands.size}`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        // Performance
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ⚡ Performance\n` +
                `**Uptime:** ${uptime}\n` +
                `**Ping:** ${Math.round(this.client.ws.ping)}ms`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        // Memory
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 💾 Memory\n` +
                `**Used:** ${memoryUsage} MB\n` +
                `**Free:** ${freeMemory} GB\n` +
                `**Total:** ${totalMemory} GB`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        // System
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🖥️ System\n` +
                `**Platform:** ${os.platform()}\n` +
                `**CPU Cores:** ${os.cpus().length}\n` +
                `**Node.js:** ${process.version}\n` +
                `**Discord.js:** v${version}`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        // Footer
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Requested by ${ctx.author.tag}`)
        );
        
        return ctx.sendMessage({ 
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
