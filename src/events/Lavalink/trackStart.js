/**
 * Track Start Event
 * 
 * Fires when a track starts playing.
 * Sends "Now Playing" embed with track information and controls.
 */

import Event from '../../structures/Event.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { formatDuration, createProgressBar, savePlayerState } from '../../managers/LavalinkHandler.js';

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
        
        // Build Now Playing embed
        const embed = this._buildNowPlayingEmbed(track, player);
        
        // Build control buttons
        const row = this._buildControlButtons(player);
        
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
                embeds: [embed],
                components: [row],
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
     * Build Now Playing embed
     * @private
     */
    _buildNowPlayingEmbed(track, player) {
        const requester = track.requester;
        const duration = track.info.isStream ? '🔴 LIVE' : formatDuration(track.info.duration);
        
        const embed = new EmbedBuilder()
            .setColor(this.client.config.color.default)
            .setAuthor({
                name: 'Now Playing',
                iconURL: this.client.user.displayAvatarURL(),
            })
            .setTitle(track.info.title)
            .setURL(track.info.uri)
            .setThumbnail(track.info.artworkUrl || track.info.thumbnail || null)
            .addFields(
                {
                    name: '`👤` Artist',
                    value: track.info.author || 'Unknown',
                    inline: true,
                },
                {
                    name: '`⏱️` Duration',
                    value: duration,
                    inline: true,
                },
                {
                    name: '`🔊` Volume',
                    value: `${player.volume}%`,
                    inline: true,
                }
            );
        
        // Add queue info
        const queueLength = player.queue.tracks.length;
        if (queueLength > 0) {
            embed.addFields({
                name: '`📜` Queue',
                value: `${queueLength} track${queueLength !== 1 ? 's' : ''} remaining`,
                inline: true,
            });
        }
        
        // Add loop mode if enabled
        if (player.repeatMode && player.repeatMode !== 'off') {
            embed.addFields({
                name: '`🔁` Loop',
                value: player.repeatMode === 'track' ? 'Track' : 'Queue',
                inline: true,
            });
        }
        
        // Add requester info
        if (requester) {
            embed.setFooter({
                text: `Requested by ${requester.username || 'Unknown'}`,
                iconURL: requester.displayAvatarURL || null,
            });
        }
        
        embed.setTimestamp();
        
        return embed;
    }
    
    /**
     * Build control buttons
     * @private
     */
    _buildControlButtons(player) {
        const isPaused = player.paused;
        
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_previous')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(player.queue.previous.length === 0),
                new ButtonBuilder()
                    .setCustomId('player_pause')
                    .setEmoji(isPaused ? '▶️' : '⏸️')
                    .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('player_stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('player_skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_loop')
                    .setEmoji('🔁')
                    .setStyle(player.repeatMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary),
            );
    }
    
    /**
     * Set up button collector for player controls
     * @private
     */
    _setupButtonCollector(message, player, guild) {
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.customId.startsWith('player_'),
            time: 600000, // 10 minutes
        });
        
        collector.on('collect', async (interaction) => {
            // Verify user is in the same voice channel
            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member?.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
                return interaction.reply({
                    content: `\`❌\` You must be in the same voice channel to use these controls!`,
                    ephemeral: true,
                });
            }
            
            try {
                switch (interaction.customId) {
                    case 'player_previous':
                        await this._handlePrevious(interaction, player);
                        break;
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
                }
            } catch (error) {
                this.client.logger.error(`[${this.client.botName}] Button handler error: ${error.message}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: `\`❌\` An error occurred!`,
                        ephemeral: true,
                    });
                }
            }
        });
        
        collector.on('end', async () => {
            try {
                // Disable buttons when collector ends
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('player_previous')
                            .setEmoji('⏮️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('player_pause')
                            .setEmoji('⏸️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('player_stop')
                            .setEmoji('⏹️')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('player_skip')
                            .setEmoji('⏭️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('player_loop')
                            .setEmoji('🔁')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                    );
                
                await message.edit({ components: [disabledRow] });
            } catch (error) {
                // Message may be deleted
            }
        });
    }
    
    /**
     * Handle previous button
     * @private
     */
    async _handlePrevious(interaction, player) {
        const previous = player.queue.previous[0];
        if (!previous) {
            return interaction.reply({
                content: `\`❌\` No previous track!`,
                ephemeral: true,
            });
        }
        
        await player.play({ track: previous });
        await interaction.reply({
            content: `\`⏮️\` Playing previous track!`,
            ephemeral: true,
        });
    }
    
    /**
     * Handle pause/resume button
     * @private
     */
    async _handlePause(interaction, player) {
        if (player.paused) {
            await player.resume();
            await interaction.reply({
                content: `\`▶️\` Resumed playback!`,
                ephemeral: true,
            });
        } else {
            await player.pause();
            await interaction.reply({
                content: `\`⏸️\` Paused playback!`,
                ephemeral: true,
            });
        }
        
        // Update button
        const newRow = this._buildControlButtons(player);
        try {
            await interaction.message.edit({ components: [newRow] });
        } catch (error) {
            // Ignore edit errors
        }
    }
    
    /**
     * Handle stop button
     * @private
     */
    async _handleStop(interaction, player) {
        await player.destroy();
        await interaction.reply({
            content: `\`⏹️\` Stopped playback and cleared the queue!`,
            ephemeral: true,
        });
    }
    
    /**
     * Handle skip button
     * @private
     */
    async _handleSkip(interaction, player) {
        await player.skip();
        await interaction.reply({
            content: `\`⏭️\` Skipped to the next track!`,
            ephemeral: true,
        });
    }
    
    /**
     * Handle loop button
     * @private
     */
    async _handleLoop(interaction, player) {
        const modes = ['off', 'track', 'queue'];
        const currentIndex = modes.indexOf(player.repeatMode || 'off');
        const nextMode = modes[(currentIndex + 1) % modes.length];
        
        await player.setRepeatMode(nextMode);
        
        const modeNames = {
            off: 'Loop disabled',
            track: 'Looping current track',
            queue: 'Looping queue',
        };
        
        await interaction.reply({
            content: `\`🔁\` ${modeNames[nextMode]}!`,
            ephemeral: true,
        });
        
        // Update button
        const newRow = this._buildControlButtons(player);
        try {
            await interaction.message.edit({ components: [newRow] });
        } catch (error) {
            // Ignore edit errors
        }
    }
}
