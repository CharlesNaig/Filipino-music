/**
 * Profile Card Generator
 * Creates a canvas-based profile card showing user music stats
 * Filipino flag theme - black bg, orange sun, blue, red
 */

import pkg from '@napi-rs/canvas';
const { createCanvas, loadImage } = pkg;
import { request } from 'undici';

// Filipino flag theme colors
const COLORS = {
    background: '#0a0a0a',      // Black
    backgroundAlt: '#111111',   // Slightly lighter black
    orange: '#e8a035',          // Filipino sun orange/yellow
    blue: '#1a3a6e',            // Filipino blue
    red: '#a82428',             // Filipino red
    text: '#ffffff',            // White text
    textMuted: '#888888',       // Muted text
    cardBg: 'rgba(30, 30, 30, 0.9)', // Dark card background
    iconBg: '#1a1a1a',          // Icon background
};

/**
 * Format duration from milliseconds to readable string
 */
function formatDuration(ms) {
    if (!ms || ms <= 0) return '0m';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
}

/**
 * Truncate text to fit width
 */
function truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}

/**
 * Draw rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Draw Spotify icon (three curved lines)
 */
function drawSpotifyIcon(ctx, x, y, size) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    
    // Green background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1DB954'; // Spotify green
    ctx.fill();
    
    // Three curved lines (black)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    for (let i = 0; i < 3; i++) {
        const radius = 5 + (i * 4);
        ctx.beginPath();
        ctx.arc(centerX, centerY + 4, radius, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
    }
}

/**
 * Draw YouTube icon (play button in rounded rectangle)
 */
function drawYouTubeIcon(ctx, x, y, size) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    
    // Red rounded rectangle background
    roundRect(ctx, x + 4, y + 8, size - 8, size - 16, 6);
    ctx.fillStyle = '#FF0000'; // YouTube red
    ctx.fill();
    
    // White play triangle
    ctx.beginPath();
    ctx.moveTo(centerX - 4, centerY - 6);
    ctx.lineTo(centerX - 4, centerY + 6);
    ctx.lineTo(centerX + 6, centerY);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
}

/**
 * Draw Filipino sun pattern in background
 */
function drawSunPattern(ctx, width, height) {
    ctx.globalAlpha = 0.03;
    
    // Draw multiple suns
    const sunPositions = [
        { x: 150, y: 100 },
        { x: 700, y: 80 },
        { x: 450, y: 400 },
    ];
    
    sunPositions.forEach(pos => {
        // Sun center
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.orange;
        ctx.fill();
        
        // Sun rays (8 main rays)
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(pos.x + Math.cos(angle) * 45, pos.y + Math.sin(angle) * 45);
            ctx.lineTo(pos.x + Math.cos(angle) * 80, pos.y + Math.sin(angle) * 80);
            ctx.strokeStyle = COLORS.orange;
            ctx.lineWidth = 8;
            ctx.stroke();
        }
    });
    
    ctx.globalAlpha = 1;
}

/**
 * Load image from URL with fallback
 */
async function loadImageFromURL(url) {
    try {
        const { body } = await request(url);
        const arrayBuffer = await body.arrayBuffer();
        return await loadImage(Buffer.from(arrayBuffer));
    } catch (error) {
        console.error('Failed to load image:', url, error.message);
        return null;
    }
}

/**
 * Generate profile card
 */
export async function generateProfileCard(options) {
    const {
        username,
        avatarURL,
        topTracks = [],
        topFriends = [],
        mostPlayed = [],
        botName = '/FILIPINO'
    } = options;

    // Canvas dimensions
    const width = 934;
    const height = 500;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background - black
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Draw sun pattern
    drawSunPattern(ctx, width, height);

    // Bot name badge (top right) - Orange
    ctx.font = 'bold 16px Arial, sans-serif';
    const badgeText = botName;
    const badgeWidth = ctx.measureText(badgeText).width + 30;
    const badgeX = width - badgeWidth - 30;
    const badgeY = 25;
    
    roundRect(ctx, badgeX, badgeY, badgeWidth, 35, 5);
    ctx.fillStyle = COLORS.orange;
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 23);

    // Avatar
    const avatarSize = 120;
    const avatarX = 60;
    const avatarY = 40;
    
    // Avatar circle border - orange
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Load and draw avatar
    const avatar = await loadImageFromURL(avatarURL);
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    } else {
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.iconBg;
        ctx.fill();
    }

    // Username
    const textX = avatarX + avatarSize + 40;
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText(username, textX, avatarY + 50);

    // Icon badges below username - Spotify and YouTube
    const iconSize = 36;
    const iconY = avatarY + 70;
    const iconGap = 15;
    
    // Spotify icon
    drawSpotifyIcon(ctx, textX, iconY, iconSize);
    
    // YouTube icon
    drawYouTubeIcon(ctx, textX + iconSize + iconGap, iconY, iconSize);

    // Section styling
    const sectionY = 190;
    const sectionHeight = 110;
    const sectionRadius = 10;
    const sectionGap = 15;

    // MOST PLAYED section (left side)
    const mostPlayedX = 35;
    const mostPlayedWidth = 430;
    
    roundRect(ctx, mostPlayedX, sectionY, mostPlayedWidth, sectionHeight, sectionRadius);
    ctx.fillStyle = COLORS.cardBg;
    ctx.fill();

    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText('MOST PLAYED', mostPlayedX + 20, sectionY + 28);

    // Draw most played songs (left section - by play count)
    mostPlayed.slice(0, 3).forEach((track, index) => {
        const itemY = sectionY + 48 + (index * 22);
        
        // Rank badge - red for #1
        ctx.beginPath();
        ctx.arc(mostPlayedX + 28, itemY, 9, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? COLORS.red : COLORS.iconBg;
        ctx.fill();
        
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), mostPlayedX + 28, itemY + 3);
        
        // Play count and track name
        ctx.font = '12px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.text;
        const playText = `${track.playCount || 0}x · ${track.title}`;
        ctx.fillText(truncateText(ctx, playText, mostPlayedWidth - 60), mostPlayedX + 45, itemY + 4);
    });

    if (mostPlayed.length === 0) {
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = COLORS.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText('No plays data yet', mostPlayedX + 20, sectionY + 65);
    }

    // TOP FRIENDS section (right side)
    const friendsX = mostPlayedX + mostPlayedWidth + sectionGap;
    const friendsRightWidth = width - friendsX - 35;
    
    roundRect(ctx, friendsX, sectionY, friendsRightWidth, sectionHeight, sectionRadius);
    ctx.fillStyle = COLORS.cardBg;
    ctx.fill();

    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText('TOP FRIENDS', friendsX + 20, sectionY + 28);

    // Draw top friends (right section)
    topFriends.slice(0, 3).forEach((friend, index) => {
        const itemY = sectionY + 48 + (index * 22);
        
        // Rank badge - blue for #1
        ctx.beginPath();
        ctx.arc(friendsX + 28, itemY, 9, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? COLORS.blue : COLORS.iconBg;
        ctx.fill();
        
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), friendsX + 28, itemY + 3);
        
        // Time and friend name
        ctx.font = '12px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.text;
        const friendText = `${formatDuration(friend.listenTime)} · ${friend.username || 'Unknown'}`;
        ctx.fillText(truncateText(ctx, friendText, friendsRightWidth - 60), friendsX + 45, itemY + 4);
    });

    if (topFriends.length === 0) {
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = COLORS.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText('No friends data yet', friendsX + 20, sectionY + 65);
    }

    // TOP TRACKS section (bottom full width)
    const tracksY = sectionY + sectionHeight + 15;
    const tracksWidth = width - 70;
    const tracksHeight = 110;
    
    roundRect(ctx, 35, tracksY, tracksWidth, tracksHeight, sectionRadius);
    ctx.fillStyle = COLORS.cardBg;
    ctx.fill();

    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText('TOP TRACKS', 55, tracksY + 28);

    // Draw top tracks (bottom section)
    topTracks.slice(0, 3).forEach((track, index) => {
        const itemY = tracksY + 48 + (index * 22);
        
        // Rank badge - orange for #1
        ctx.beginPath();
        ctx.arc(53, itemY, 9, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? COLORS.orange : COLORS.iconBg;
        ctx.fill();
        
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillStyle = index === 0 ? '#000000' : COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), 53, itemY + 3);
        
        // Time and track name
        ctx.font = '12px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.text;
        const trackText = `${formatDuration(track.listenTime)} · ${track.title}`;
        ctx.fillText(truncateText(ctx, trackText, tracksWidth - 50), 70, itemY + 4);
    });

    if (topTracks.length === 0) {
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = COLORS.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText('No tracks data yet', 55, tracksY + 65);
    }

    return canvas.encode('png');
}

export default { generateProfileCard };
