import pkg from 'mongoose';
const { Schema, model, models } = pkg;

/**
 * Player Schema
 * Stores the state of music players for session resuming and persistence
 */
const PlayerSchema = new Schema({
    // Guild ID as the primary key
    _id: {
        type: String,
        required: true,
    },
    
    // Bot ID handling this player
    botId: {
        type: String,
        required: true,
        index: true,
    },
    
    // Voice channel ID
    voiceChannelId: {
        type: String,
        required: true,
    },
    
    // Text channel ID for player messages
    textChannelId: {
        type: String,
        required: true,
    },
    
    // Current volume (0-150)
    volume: {
        type: Number,
        default: 80,
        min: 0,
        max: 150,
    },
    
    // Loop mode: 'off', 'track', 'queue'
    loopMode: {
        type: String,
        enum: ['off', 'track', 'queue'],
        default: 'off',
    },
    
    // Whether the player is paused
    paused: {
        type: Boolean,
        default: false,
    },
    
    // 24/7 mode (stay in voice even when queue empty)
    twentyFourSeven: {
        type: Boolean,
        default: false,
    },
    
    // Auto-play related tracks when queue ends
    autoPlay: {
        type: Boolean,
        default: false,
    },
    
    // Current track position in milliseconds
    position: {
        type: Number,
        default: 0,
    },
    
    // Currently playing track (serialized)
    currentTrack: {
        type: Schema.Types.Mixed,
        default: null,
    },
    
    // Queue of tracks (serialized)
    queue: {
        type: [Schema.Types.Mixed],
        default: [],
    },
    
    // Previous tracks history
    previousTracks: {
        type: [Schema.Types.Mixed],
        default: [],
        validate: [arr => arr.length <= 50, 'Previous tracks limited to 50'], // Limit history
    },
    
    // Player message ID (for Now Playing embed)
    messageId: {
        type: String,
        default: null,
    },
    
    // User who requested the current track
    requesterId: {
        type: String,
        default: null,
    },
    
    // Filters applied to player
    filters: {
        type: Schema.Types.Mixed,
        default: {},
    },
    
    // Lavalink node ID handling this player
    nodeId: {
        type: String,
        default: null,
    },
    
    // Session ID for resuming
    sessionId: {
        type: String,
        default: null,
    },
    
    // Whether player is destroyed/stopped
    destroyed: {
        type: Boolean,
        default: false,
    },
    
    // Last update timestamp
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
    
}, {
    timestamps: true,
});

// Index for finding active players
PlayerSchema.index({ botId: 1, destroyed: 1 });
PlayerSchema.index({ lastUpdated: 1 });
PlayerSchema.index({ twentyFourSeven: 1 });

// Static method to save player state
PlayerSchema.statics.saveState = async function(guildId, playerData) {
    const data = {
        ...playerData,
        lastUpdated: new Date(),
    };
    
    return this.findByIdAndUpdate(
        guildId,
        { $set: data },
        { upsert: true, new: true }
    );
};

// Static method to load player state
PlayerSchema.statics.loadState = async function(guildId) {
    const state = await this.findById(guildId);
    if (!state || state.destroyed) return null;
    return state;
};

// Static method to find all active players for a bot
PlayerSchema.statics.findActiveByBot = function(botId) {
    return this.find({ 
        botId, 
        destroyed: false 
    }).exec();
};

// Static method to find all 24/7 players
PlayerSchema.statics.findTwentyFourSevenPlayers = function() {
    return this.find({ 
        twentyFourSeven: true, 
        destroyed: false 
    }).exec();
};

// Static method to mark player as destroyed
PlayerSchema.statics.markDestroyed = async function(guildId) {
    return this.findByIdAndUpdate(
        guildId,
        { 
            $set: { 
                destroyed: true,
                currentTrack: null,
                queue: [],
                position: 0,
                lastUpdated: new Date()
            }
        },
        { new: true }
    );
};

// Static method to clear old destroyed players
PlayerSchema.statics.cleanupDestroyed = async function(olderThan = 86400000) {
    const cutoffTime = new Date(Date.now() - olderThan);
    return this.deleteMany({
        destroyed: true,
        lastUpdated: { $lt: cutoffTime }
    });
};

// Static method to count active players per bot
PlayerSchema.statics.countActiveByBot = function(botId) {
    return this.countDocuments({ botId, destroyed: false });
};

// Instance method to add track to queue
PlayerSchema.methods.addToQueue = async function(track, position = -1) {
    if (position >= 0 && position < this.queue.length) {
        this.queue.splice(position, 0, track);
    } else {
        this.queue.push(track);
    }
    this.lastUpdated = new Date();
    return this.save();
};

// Instance method to add track to previous history
PlayerSchema.methods.addToPrevious = async function(track) {
    this.previousTracks.unshift(track);
    // Keep only last 50 tracks
    if (this.previousTracks.length > 50) {
        this.previousTracks = this.previousTracks.slice(0, 50);
    }
    this.lastUpdated = new Date();
    return this.save();
};

// Instance method to update position
PlayerSchema.methods.updatePosition = async function(position) {
    this.position = position;
    this.lastUpdated = new Date();
    return this.save();
};

// Instance method to set current track
PlayerSchema.methods.setCurrentTrack = async function(track, requesterId = null) {
    // Move current track to previous if exists
    if (this.currentTrack) {
        await this.addToPrevious(this.currentTrack);
    }
    
    this.currentTrack = track;
    this.requesterId = requesterId;
    this.position = 0;
    this.lastUpdated = new Date();
    return this.save();
};

// Instance method to clear queue
PlayerSchema.methods.clearQueue = async function() {
    this.queue = [];
    this.lastUpdated = new Date();
    return this.save();
};

// Instance method to shuffle queue
PlayerSchema.methods.shuffleQueue = async function() {
    for (let i = this.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.lastUpdated = new Date();
    return this.save();
};

export default models.Player || model('Player', PlayerSchema);
