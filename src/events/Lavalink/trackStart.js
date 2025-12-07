/**
 * Track Start Event
 * 
 * Fires when a track starts playing.
 * Sends "Now Playing" container with track information and controls.
 */

import Event from '../../structures/Event.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } from 'discord.js';
import { formatDuration, savePlayerState } from '../../managers/LavalinkHandler.js';
import Favorite from '../../schemas/Favorite.js';
import emojis from '../../emojis.js';

export default class TrackStart extends Event {
    constructor(...args) {
        super(...args, {
            name: 'trackStart',
        });
    }
    
    /**
     * @param {Object} player - Lavalink player
     * @param {Object} track - Track that started
     */
    async run(player, track) {
        if (!track) return;
        
        const guild = this.client.guilds.cache.get(player.guildId);
        if (!guild) return;
        
        const textChannel = guild.channels.cache.get(player.textChannelId);
        if (!textChannel) return;
        
        this.client.logger.info(`[${this.client.botName}] Now playing: ${track.info.title} in ${guild.name}`);
        
        // Update player state in database
        await savePlayerState(player, this.client);
        
        // Build Now Playing container with buttons inside
        const components = this._buildNowPlayingComponents(track, player);
        
        try {
            // Delete previous now playing message
            const previousMessageId = player.get('nowPlayingMessageId');
            if (previousMessageId) {
                try {
                    const previousMessage = await textChannel.messages.fetch(previousMessageId);
                    if (previousMessage) {
                        await previousMessage.delete();
                    }
                } catch (error) {
                    // Message already deleted or not found
                }
            }
            
            // Send new now playing message
            const message = await textChannel.send({
                components,
                flags: MessageFlags.IsComponentsV2
            });
            
            // Store message ID for later deletion
            player.set('nowPlayingMessageId', message.id);
            
            // Set up button collector
            this._setupButtonCollector(message, player, guild);
            
        } catch (error) {
            this.client.logger.error(`[${this.client.botName}] Failed to send now playing: ${error.message}`);
        }
    }
    
    /**
     * Build Now Playing components (container with media gallery and buttons)
     * @private
     */
    _buildNowPlayingComponents(track, player) {
        const container = new ContainerBuilder();

        // Media Gallery with track artwork
        if (track.info.artworkUrl || track.info.thumbnail) {
            const mediaGallery = new MediaGalleryBuilder()
                .addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(track.info.artworkUrl || track.info.thumbnail)
                        .setDescription(`${track.info.title} - ${track.info.author}`)
                );
            container.addMediaGalleryComponents(mediaGallery);
        }

        // Now Playing header and track info
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.nowPlaying} Now Playing...\n` +
                `[${track.info.title}](${track.info.uri}) ${track.info.author}`
            )
        );

        // Separator before buttons
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Row 1: Main playback controls
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_pause')
                    .setEmoji(player.paused ? emojis.player.play : emojis.player.pause)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_skip')
                    .setEmoji(emojis.player.skip)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_stop')
                    .setEmoji(emojis.player.stop)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_loop')
                    .setEmoji(emojis.player.loop)
                    .setStyle(ButtonStyle.Secondary),
            );
        container.addActionRowComponents(row1);

        // Row 2: Autoplay
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_autoplay')
                    .setEmoji(emojis.player.autoplay)
                    .setStyle(ButtonStyle.Secondary),
            );
        container.addActionRowComponents(row2);

        // Row 3: Queue, Lyrics, Shuffle, Volume
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_queue')
                    .setEmoji(emojis.player.queue)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_lyrics')
                    .setEmoji(emojis.player.lyrics)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_shuffle')
                    .setEmoji(emojis.player.shuffle)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('player_volume')
                    .setEmoji(emojis.player.volume)
                    .setStyle(ButtonStyle.Secondary),
            );
        container.addActionRowComponents(row3);

        // Row 4: Favorite
        const row4 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_favorite')
                    .setEmoji(emojis.player.favorite)
                    .setStyle(ButtonStyle.Secondary),
            );
        container.addActionRowComponents(row4);

        // Separator after buttons
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        return [container];
    }
    
    /**
     * Set up button collector for player controls
     * @private
     */
    _setupButtonCollector(message, player, guild) {
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.customId.startsWith('player_'),
            time: 600000,
        });
        
        collector.on('collect', async (interaction) => {
            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member?.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
                return interaction.reply({
                    content: `\`❌\` You must be in the same voice channel to use these controls!`,
                    ephemeral: true,
                });
            }
            
            try {
                switch (interaction.customId) {
                    case 'player_pause':
                        await this._handlePause(interaction, player);
                        break;
                    case 'player_stop':
                        await this._handleStop(interaction, player);
                        break;
                    case 'player_skip':
                        await this._handleSkip(interaction, player);
                        break;
                    case 'player_loop':
                        await this._handleLoop(interaction, player);
                        break;
                    case 'player_autoplay':
                        await this._handleAutoplay(interaction, player);
                        break;
                    case 'player_queue':
                        await this._handleQueue(interaction, player);
                        break;
                    case 'player_shuffle':
                        await this._handleShuffle(interaction, player);
                        break;
                    case 'player_volume':
                        await this._handleVolume(interaction, player);
                        break;
                    case 'player_lyrics':
                        await this._handleLyrics(interaction, player);
                        break;
                    case 'player_favorite':
                        await this._handleFavorite(interaction, player);
                        break;
                }
            } catch (error) {
                this.client.logger.error(`[${this.client.botName}] Button handler error: ${error.message}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: `\`❌\` An error occurred!`, ephemeral: true });
                }
            }
        });
        
        collector.on('end', async () => {
            try {
                const track = player.queue?.current;
                if (!track) return;

                const container = this._buildDisabledContainer(track);
                await message.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
            } catch (error) {
                // Message may be deleted
            }
        });
    }

    _buildDisabledContainer(track) {
        const container = new ContainerBuilder();

        if (track.info.artworkUrl || track.info.thumbnail) {
            const mediaGallery = new MediaGalleryBuilder()
                .addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(track.info.artworkUrl || track.info.thumbnail)
                        .setDescription(`${track.info.title} - ${track.info.author}`)
                );
            container.addMediaGalleryComponents(mediaGallery);
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.nowPlaying} Now Playing...\n[${track.info.title}](${track.info.uri}) ${track.info.author}`
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('player_pause').setEmoji(emojis.player.pause).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('player_skip').setEmoji(emojis.player.skip).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('player_stop').setEmoji(emojis.player.stop).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('player_loop').setEmoji(emojis.player.loop).setStyle(ButtonStyle.Secondary).setDisabled(true),
        );
        container.addActionRowComponents(row1);

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('player_autoplay').setEmoji(emojis.player.autoplay).setStyle(ButtonStyle.Secondary).setDisabled(true),
        );
        container.addActionRowComponents(row2);

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('player_queue').setEmoji(emojis.player.queue).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('player_lyrics').setEmoji(emojis.player.lyrics).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('player_shuffle').setEmoji(emojis.player.shuffle).setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('player_volume').setEmoji(emojis.player.volume).setStyle(ButtonStyle.Secondary).setDisabled(true),
        );
        container.addActionRowComponents(row3);

        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('player_favorite').setEmoji(emojis.player.favorite).setStyle(ButtonStyle.Secondary).setDisabled(true),
        );
        container.addActionRowComponents(row4);

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        return container;
    }
    
    _buildResponseContainer(emoji, title, description) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emoji} ${title}\n${description}`)
        );
        return container;
    }

    async _handlePause(interaction, player) {
        const track = player.queue.current;
        
        if (player.paused) {
            await player.resume();
            // Update the now playing message with play emoji (since it's now playing)
            const updatedComponents = this._buildNowPlayingComponents(track, player);
            await interaction.update({ components: updatedComponents, flags: MessageFlags.IsComponentsV2 });
        } else {
            await player.pause();
            // Update the now playing message with pause emoji (since it's paused)
            const updatedComponents = this._buildNowPlayingComponents(track, player);
            await interaction.update({ components: updatedComponents, flags: MessageFlags.IsComponentsV2 });
        }
    }
    
    async _handleStop(interaction, player) {
        await player.destroy();
        const container = this._buildResponseContainer(emojis.player.stop, 'Stopped', 'Playback stopped and queue cleared.');
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }
    
    async _handleSkip(interaction, player) {
        const nextTrack = player.queue.tracks[0];
        await player.skip();
        const container = this._buildResponseContainer(emojis.player.skip, 'Skipped', 
            nextTrack ? `Now playing: **${nextTrack.info.title}**` : 'No more tracks in queue.');
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }
    
    async _handleLoop(interaction, player) {
        const modes = ['off', 'track', 'queue'];
        const currentIndex = modes.indexOf(player.repeatMode || 'off');
        const nextMode = modes[(currentIndex + 1) % modes.length];
        await player.setRepeatMode(nextMode);
        const modeInfo = { 
            off: { emoji: '➡️', text: 'Loop disabled' }, 
            track: { emoji: emojis.player.loopTrack, text: 'Looping current track' }, 
            queue: { emoji: emojis.player.loop, text: 'Looping entire queue' } 
        };
        const container = this._buildResponseContainer(modeInfo[nextMode].emoji, 'Loop Mode', modeInfo[nextMode].text);
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }

    async _handleAutoplay(interaction, player) {
        const autoplay = !player.get('autoplay');
        player.set('autoplay', autoplay);
        const container = this._buildResponseContainer(emojis.player.autoplay, 'Autoplay', 
            autoplay ? 'Autoplay has been **enabled**. Similar tracks will play when the queue ends.' 
                     : 'Autoplay has been **disabled**.');
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }

    async _handleQueue(interaction, player) {
        const queue = player.queue.tracks;
        const container = new ContainerBuilder();
        
        if (queue.length === 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.player.queue} Queue\nThe queue is empty! Use \`/play\` to add tracks.`)
            );
        } else {
            const queueList = queue.slice(0, 5).map((track, i) => {
                const duration = formatDuration(track.info.duration);
                const title = track.info.title.length > 35 ? track.info.title.substring(0, 35) + '...' : track.info.title;
                return `**${i + 1}.** ${title} \`${duration}\``;
            }).join('\n');
            
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${emojis.player.queue} Queue (${queue.length} tracks)\n${queueList}${queue.length > 5 ? `\n\n*... and ${queue.length - 5} more tracks*` : ''}`
                )
            );
        }
        
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }

    async _handleShuffle(interaction, player) {
        if (player.queue.tracks.length < 2) {
            const container = this._buildResponseContainer(emojis.status.error, 'Cannot Shuffle', 'Not enough tracks in queue to shuffle.');
            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
        player.queue.shuffle();
        const container = this._buildResponseContainer(emojis.player.shuffle, 'Shuffled', `Queue has been shuffled! (${player.queue.tracks.length} tracks)`);
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }

    async _handleVolume(interaction, player) {
        const volumeBar = '█'.repeat(Math.floor(player.volume / 10)) + '░'.repeat(10 - Math.floor(player.volume / 10));
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.volume} Volume\n**${player.volume}%** \`${volumeBar}\`\n\nUse \`/volume <0-100>\` to change.`
            )
        );
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }

    async _handleLyrics(interaction, player) {
        const track = player.queue.current;
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${emojis.player.lyrics} Lyrics\n**${track.info.title}**\n\nLyrics feature coming soon!`
            )
        );
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }

    async _handleFavorite(interaction, player) {
        const track = player.queue.current;
        const favorites = await Favorite.getOrCreate(interaction.user.id);
        
        const result = await favorites.addTrack({
            title: track.info.title,
            author: track.info.author,
            uri: track.info.uri,
            duration: track.info.duration,
            artworkUrl: track.info.artworkUrl
        });

        const container = new ContainerBuilder();
        
        if (result.success) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${emojis.player.favorite} Added to Favorites\n**${track.info.title}**\nby ${track.info.author}`
                )
            );
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${emojis.status.error} Already in Favorites\n**${track.info.title}** is already in your favorites!`
                )
            );
        }
        
        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }
}
