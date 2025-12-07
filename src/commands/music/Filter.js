/**
 * Filter Command - Apply audio filters to the player
 */

import Command from '../../structures/Command.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import emojis from '../../emojis.js';

const FILTERS = {
    bassboost: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.7 }, { band: 2, gain: 0.8 }, { band: 3, gain: 0.55 }, { band: 4, gain: 0.25 }] },
    nightcore: { timescale: { speed: 1.3, pitch: 1.3, rate: 1.0 } },
    vaporwave: { timescale: { speed: 0.85, pitch: 0.9, rate: 1.0 } },
    pop: { equalizer: [{ band: 0, gain: -0.25 }, { band: 1, gain: 0.48 }, { band: 2, gain: 0.59 }, { band: 3, gain: 0.72 }, { band: 4, gain: 0.56 }] },
    soft: { lowPass: { smoothing: 20.0 } },
    treblebass: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.67 }, { band: 2, gain: 0.67 }, { band: 10, gain: 0.5 }, { band: 11, gain: 0.55 }, { band: 12, gain: 0.6 }] },
    '8d': { rotation: { rotationHz: 0.2 } },
    karaoke: { karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } },
    vibrato: { vibrato: { frequency: 4.0, depth: 0.75 } },
    tremolo: { tremolo: { frequency: 4.0, depth: 0.75 } },
};

export default class Filter extends Command {
    constructor(client, file) {
        super(client, {
            name: 'filter',
            description: {
                content: 'Apply audio filters to the player',
                usage: 'filter <name|off|list>',
                examples: ['filter bassboost', 'filter nightcore', 'filter off', 'filter list'],
            },
            aliases: ['filters', 'fx', 'effect'],
            cooldown: 5,
            args: true,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'filter',
                    description: 'Filter to apply (or "off" to disable, "list" to see all)',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Off', value: 'off' },
                        { name: 'List All', value: 'list' },
                        { name: 'Bass Boost', value: 'bassboost' },
                        { name: 'Nightcore', value: 'nightcore' },
                        { name: 'Vaporwave', value: 'vaporwave' },
                        { name: 'Pop', value: 'pop' },
                        { name: 'Soft', value: 'soft' },
                        { name: 'Treble Bass', value: 'treblebass' },
                        { name: '8D Audio', value: '8d' },
                        { name: 'Karaoke', value: 'karaoke' },
                        { name: 'Vibrato', value: 'vibrato' },
                        { name: 'Tremolo', value: 'tremolo' },
                    ],
                },
            ],
            category: 'music',
        });
        this.file = file;
    }

    async run(ctx, args) {
        const filterName = ctx.isInteraction 
            ? ctx.interaction.options.getString('filter')
            : args[0]?.toLowerCase();

        if (!filterName) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Please specify a filter! Use \`filter list\` to see all.` });
        }

        // List filters
        if (filterName === 'list') {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.misc.filter} Available Filters`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    Object.keys(FILTERS).map(f => `\`${f}\``).join(', ') +
                    `\n\nUse \`filter <name>\` to apply or \`filter off\` to disable.`
                )
            );
            return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        const member = ctx.member;
        const voiceChannel = member.voice?.channel;

        if (!voiceChannel) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in a voice channel!` });
        }

        const player = this.client.lavalink?.players.get(ctx.guild.id);

        if (!player || !player.queue.current) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Nothing is playing right now!` });
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` You need to be in the same voice channel as me!` });
        }

        // Turn off filters
        if (filterName === 'off') {
            await player.setFilters({});
            player.set('currentFilter', null);
            
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.misc.filter} Filters Disabled\nAll audio filters have been removed.`)
            );
            return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // Apply filter
        const filter = FILTERS[filterName];
        if (!filter) {
            return ctx.sendMessage({ content: `\`${emojis.status.error}\` Unknown filter! Use \`filter list\` to see available filters.` });
        }

        await player.setFilters(filter);
        player.set('currentFilter', filterName);

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.misc.filter} Filter Applied\n**${filterName}** filter is now active!\n\n-# Use \`filter off\` to disable.`
            )
        );
        return ctx.sendMessage({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
}
