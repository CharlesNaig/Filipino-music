/**
 * Playlist Schema
 * Stores user playlists with tracks
 */

import pkg from 'mongoose';
const { Schema, model } = pkg;

const PlaylistSchema = new Schema({
    // Unique playlist ID
    _id: { type: String, required: true },
    
    // Owner user ID
    userId: { type: String, required: true, index: true },
    
    // Playlist info
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isPublic: { type: Boolean, default: false },
    
    // Tracks in playlist
    tracks: [{
        title: { type: String, required: true },
        author: { type: String },
        uri: { type: String, required: true },
        duration: { type: Number, default: 0 },
        artworkUrl: { type: String },
        addedAt: { type: Date, default: Date.now }
    }],
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate unique playlist ID
PlaylistSchema.statics.generateId = function() {
    return `pl_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create a new playlist
PlaylistSchema.statics.createPlaylist = async function(userId, name, description = '') {
    const existingCount = await this.countDocuments({ userId });
    if (existingCount >= 25) {
        return { success: false, message: 'You can only have up to 25 playlists!' };
    }
    
    const existing = await this.findOne({ userId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
        return { success: false, message: 'You already have a playlist with that name!' };
    }
    
    const playlist = new this({
        _id: this.generateId(),
        userId,
        name,
        description,
        tracks: []
    });
    
    await playlist.save();
    return { success: true, playlist, message: `Playlist "${name}" created!` };
};

// Get user's playlists
PlaylistSchema.statics.getUserPlaylists = async function(userId) {
    return this.find({ userId }).sort({ createdAt: -1 });
};

// Find playlist by name for a user
PlaylistSchema.statics.findByName = async function(userId, name) {
    return this.findOne({ userId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
};

// Find public playlist by ID
PlaylistSchema.statics.findPublicById = async function(playlistId) {
    return this.findOne({ _id: playlistId, isPublic: true });
};

// Add track to playlist
PlaylistSchema.methods.addTrack = async function(track) {
    if (this.tracks.length >= 200) {
        return { success: false, message: 'Playlist can only have up to 200 tracks!' };
    }
    
    const exists = this.tracks.some(t => t.uri === track.uri);
    if (exists) {
        return { success: false, message: 'Track is already in this playlist!' };
    }
    
    this.tracks.push({
        title: track.title,
        author: track.author,
        uri: track.uri,
        duration: track.duration || 0,
        artworkUrl: track.artworkUrl || null,
        addedAt: new Date()
    });
    
    this.updatedAt = new Date();
    await this.save();
    return { success: true, message: `Added "${track.title}" to playlist!` };
};

// Remove track from playlist by index (1-based)
PlaylistSchema.methods.removeTrack = async function(index) {
    if (index < 1 || index > this.tracks.length) {
        return { success: false, message: 'Invalid track number!' };
    }
    
    const removed = this.tracks.splice(index - 1, 1)[0];
    this.updatedAt = new Date();
    await this.save();
    return { success: true, message: `Removed "${removed.title}" from playlist!`, track: removed };
};

// Rename playlist
PlaylistSchema.methods.rename = async function(newName) {
    const existing = await model('Playlist').findOne({ 
        userId: this.userId, 
        name: { $regex: new RegExp(`^${newName}$`, 'i') },
        _id: { $ne: this._id }
    });
    
    if (existing) {
        return { success: false, message: 'You already have a playlist with that name!' };
    }
    
    this.name = newName;
    this.updatedAt = new Date();
    await this.save();
    return { success: true, message: `Playlist renamed to "${newName}"!` };
};

// Get total duration
PlaylistSchema.methods.getTotalDuration = function() {
    return this.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
};

export default model('Playlist', PlaylistSchema);
