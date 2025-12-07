/**
 * Favorite Schema
 * Stores user's favorite tracks
 */

import pkg from 'mongoose';
const { Schema, model } = pkg;

const FavoriteSchema = new Schema({
    _id: { type: String, required: true }, // odod odod odod odod odod userId
    
    // Favorite tracks
    tracks: [{
        title: { type: String, required: true },
        author: { type: String },
        uri: { type: String, required: true },
        duration: { type: Number, default: 0 },
        artworkUrl: { type: String },
        addedAt: { type: Date, default: Date.now }
    }],
    
    // Last updated
    updatedAt: { type: Date, default: Date.now }
});

// Get all favorites
FavoriteSchema.methods.getFavorites = function(limit = 25) {
    return this.tracks.slice(0, limit);
};

// Add a track to favorites
FavoriteSchema.methods.addTrack = async function(track) {
    // Check if already exists
    const exists = this.tracks.some(t => t.uri === track.uri);
    if (exists) {
        return { success: false, message: 'Track is already in your favorites!' };
    }
    
    // Limit to 100 favorites
    if (this.tracks.length >= 100) {
        return { success: false, message: 'You have reached the maximum of 100 favorites!' };
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
    
    return { success: true, message: 'Track added to favorites!' };
};

// Remove a track from favorites by index (1-based)
FavoriteSchema.methods.removeTrack = async function(index) {
    if (index < 1 || index > this.tracks.length) {
        return { success: false, message: 'Invalid track number!' };
    }
    
    const removed = this.tracks.splice(index - 1, 1)[0];
    this.updatedAt = new Date();
    await this.save();
    
    return { success: true, message: `Removed "${removed.title}" from favorites!`, track: removed };
};

// Remove a track by URI
FavoriteSchema.methods.removeTrackByUri = async function(uri) {
    const index = this.tracks.findIndex(t => t.uri === uri);
    if (index === -1) {
        return { success: false, message: 'Track not found in favorites!' };
    }
    
    const removed = this.tracks.splice(index, 1)[0];
    this.updatedAt = new Date();
    await this.save();
    
    return { success: true, message: `Removed "${removed.title}" from favorites!`, track: removed };
};

// Check if a track is in favorites
FavoriteSchema.methods.hasTrack = function(uri) {
    return this.tracks.some(t => t.uri === uri);
};

// Static method to get or create user favorites
FavoriteSchema.statics.getOrCreate = async function(userId) {
    let favorites = await this.findById(userId);
    if (!favorites) {
        favorites = new this({ _id: userId, tracks: [] });
        await favorites.save();
    }
    return favorites;
};

export default model('Favorite', FavoriteSchema);
