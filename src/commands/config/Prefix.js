import Command from "../../structures/Command.js";
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from "discord.js";
import PrefixData from "../../schemas/prefix.js";
import emojis from '../../emojis.js';

export default class Prefix extends Command {
    constructor(client) {
        super(client, {
            name: 'prefix',
            description: {
                content: 'Change the prefix of the bot',
                usage: '<new prefix>',
                examples: ['prefix !'],
            },
            aliases: ['setprefix'],
            category: 'config',
            cooldown: 3,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: ['ManageGuild'],
            },
            slashCommand: true,
            options: [
                {
                    name: "prefix",
                    description: "The new prefix",
                    type: 3,
                    required: true,
                },
            ]
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
        const prefix = ctx.isInteraction 
            ? ctx.interaction.options.getString('prefix')
            : args.join(" ");

        if (prefix.length > 3) {
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.error} Error`, 'Your new prefix must be under `3` characters!')],
                flags: MessageFlags.IsComponentsV2
            });
        }

        let data = await PrefixData.findOne({ _id: ctx.guild.id });
        if (!data) {
            data = new PrefixData({
                _id: ctx.guild.id,
                prefix: prefix,
            });
            await data.save();
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.success} Prefix Set`, `Set the prefix to \`${prefix}\``)],
                flags: MessageFlags.IsComponentsV2
            });
        } else {
            data.prefix = prefix;
            await data.save();
            return ctx.sendMessage({ 
                components: [this._buildContainer(`${emojis.status.success} Prefix Updated`, `Updated the prefix to \`${prefix}\``)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
}
