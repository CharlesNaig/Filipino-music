import pkg from 'mongoose';
const { Schema, model } = pkg;

const UserStatsSchema = new Schema({
    _id: { type: String, required: true }, // odod odod odod userId
    
    // Total listening time in milliseconds
    totalListenTime: { type: Number, default: 0 },
    
    // Track history with listen time
    tracks: [{
        title: { type: String, required: true },
        author: { type: String },
        uri: { type: String },
        listenTime: { type: Number, default: 0 }, // ms
        playCount: { type: Number, default: 0 },
        lastPlayed: { type: Date, default: Date.now }
    }],
    
    // Top friends (users they listen with most)
    friends: [{
        userId: { type: String, required: true },
        username: { type: String },
        listenTime: { type: Number, default: 0 }, // ms listened together
        lastListened: { type: Date, default: Date.now }
    }],
    
    // Last updated
    updatedAt: { type: Date, default: Date.now }
});

// Get top tracks
UserStatsSchema.methods.getTopTracks = function(limit = 3) {
    return this.tracks
        .sort((a, b) => b.listenTime - a.listenTime)
        .slice(0, limit);
};

// Get top friends
UserStatsSchema.methods.getTopFriends = function(limit = 3) {
    return this.friends
        .sort((a, b) => b.listenTime - a.listenTime)
        .slice(0, limit);
};

// Get most played tracks (by play count)
UserStatsSchema.methods.getMostPlayed = function(limit = 3) {
    return this.tracks
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, limit);
};

// Add or update track listen time
UserStatsSchema.methods.addTrackTime = async function(track, duration) {
    const existingTrack = this.tracks.find(t => t.uri === track.uri || t.title === track.title);
    
    if (existingTrack) {
        existingTrack.listenTime += duration;
        existingTrack.playCount += 1;
        existingTrack.lastPlayed = new Date();
    } else {
        this.tracks.push({
            title: track.title,
            author: track.author,
            uri: track.uri,
            listenTime: duration,
            playCount: 1,
            lastPlayed: new Date()
        });
    }
    
    this.totalListenTime += duration;
    this.updatedAt = new Date();
    
    // Keep only top 100 tracks
    if (this.tracks.length > 100) {
        this.tracks = this.tracks
            .sort((a, b) => b.listenTime - a.listenTime)
            .slice(0, 100);
    }
    
    return this.save();
};

// Add friend listen time
UserStatsSchema.methods.addFriendTime = async function(friendId, friendUsername, duration) {
    const existingFriend = this.friends.find(f => f.userId === friendId);
    
    if (existingFriend) {
        existingFriend.listenTime += duration;
        existingFriend.username = friendUsername;
        existingFriend.lastListened = new Date();
    } else {
        this.friends.push({
            userId: friendId,
            username: friendUsername,
            listenTime: duration,
            lastListened: new Date()
        });
    }
    
    this.updatedAt = new Date();
    
    // Keep only top 50 friends
    if (this.friends.length > 50) {
        this.friends = this.friends
            .sort((a, b) => b.listenTime - a.listenTime)
            .slice(0, 50);
    }
    
    return this.save();
};

// Static method to get or create user stats
UserStatsSchema.statics.getOrCreate = async function(userId) {
    let stats = await this.findById(userId);
    if (!stats) {
        stats = new this({ _id: userId });
        await stats.save();
    }
    return stats;
};

export default model('UserStats', UserStatsSchema);
