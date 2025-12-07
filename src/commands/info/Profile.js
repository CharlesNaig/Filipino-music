/**
 * Profile Command
 * 
 * Display user's music listening profile with stats
 */

import Command from '../../structures/Command.js';
import { AttachmentBuilder } from 'discord.js';
import UserStats from '../../schemas/UserStats.js';
import { generateProfileCard } from '../../managers/ProfileCard.js';
import emojis from '../../emojis.js';

export default class Profile extends Command {
    constructor(client, file) {
        super(client, {
            name: 'profile',
            description: {
                content: 'View your music listening profile and stats',
                usage: 'profile [@user]',
                examples: ['profile', 'profile @user'],
            },
            aliases: ['me', 'musicprofile'],
            cooldown: 10,
            args: false,
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'AttachFiles'],
                user: [],
            },
            slashCommand: true,
            options: [
                {
                    name: 'user',
                    description: 'User to view profile of',
                    type: 6, // User
                    required: false,
                },
            ],
            category: 'info',
        });

        this.file = file;
    }

    async run(ctx, args) {
        // Get target user
        let targetUser;
        if (ctx.isInteraction) {
            targetUser = ctx.interaction.options.getUser('user') || ctx.author;
        } else {
            const mention = ctx.message?.mentions?.users?.first();
            targetUser = mention || ctx.author;
        }

        // Send loading message
        const loadingMsg = await ctx.sendMessage({
            content: `${emojis.player.music} **Loading...** Generating your profile card...`
        });

        try {
            // Get user stats from database
            const userStats = await UserStats.getOrCreate(targetUser.id);
            
            // Get top tracks, friends, and most played
            const topTracks = userStats.getTopTracks(3);
            const topFriends = userStats.getTopFriends(3);
            const mostPlayed = userStats.getMostPlayed(3);

            this.client.logger.info(`[Profile] Generating card for ${targetUser.username}`);

            // Generate profile card
            const profileBuffer = await generateProfileCard({
                username: targetUser.username,
                avatarURL: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
                totalListenTime: userStats.totalListenTime,
                topTracks: topTracks.map(t => ({
                    title: t.title,
                    author: t.author,
                    listenTime: t.listenTime
                })),
                topFriends: topFriends.map(f => ({
                    username: f.username,
                    listenTime: f.listenTime
                })),
                mostPlayed: mostPlayed.map(t => ({
                    title: t.title,
                    author: t.author,
                    playCount: t.playCount
                })),
                botName: 'FILIPINO MUSIC'
            });

            this.client.logger.info(`[Profile] Card generated, size: ${profileBuffer.length} bytes`);

            // Create attachment
            const attachment = new AttachmentBuilder(profileBuffer, { name: 'profile.png' });

            // Edit the loading message with the image
            if (ctx.isInteraction) {
                await ctx.interaction.editReply({
                    content: null,
                    files: [attachment]
                });
            } else {
                await loadingMsg.edit({
                    content: null,
                    files: [attachment]
                });
            }

        } catch (error) {
            this.client.logger.error(`[Profile] Error: ${error.message}`);
            this.client.logger.error(`[Profile] Stack: ${error.stack}`);
            
            const errorMsg = `${emojis.status.error} **Error:** Failed to generate profile: ${error.message}`;
            
            if (ctx.isInteraction) {
                await ctx.interaction.editReply({ content: errorMsg });
            } else {
                await loadingMsg.edit({ content: errorMsg });
            }
        }
    }
}
