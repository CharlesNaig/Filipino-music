import pkg from 'mongoose';
const { Schema, model, models } = pkg;

/**
 * Bot Status Schema
 * Tracks the current status and metrics of each bot in the cluster
 */
const BotStatusSchema = new Schema({
    // Unique bot identifier (e.g., "bot-1", "bot-2")
    _id: {
        type: String,
        required: true,
    },
    
    // Bot display name
    name: {
        type: String,
        required: true,
    },
    
    // Discord client ID
    clientId: {
        type: String,
        required: true,
    },
    
    // Current status of the bot
    status: {
        type: String,
        enum: ['Available', 'InUse', 'Offline', 'Starting', 'Error'],
        default: 'Offline',
    },
    
    // Whether this is the main/primary bot
    isMain: {
        type: Boolean,
        default: false,
    },
    
    // Current number of active music players
    playerCount: {
        type: Number,
        default: 0,
    },
    
    // Number of guilds this bot is serving
    guildCount: {
        type: Number,
        default: 0,
    },
    
    // Memory usage in MB
    memoryUsage: {
        type: Number,
        default: 0,
    },
    
    // CPU usage percentage
    cpuUsage: {
        type: Number,
        default: 0,
    },
    
    // Uptime in milliseconds
    uptime: {
        type: Number,
        default: 0,
    },
    
    // WebSocket latency in ms
    ping: {
        type: Number,
        default: 0,
    },
    
    // Last heartbeat timestamp
    lastHeartbeat: {
        type: Date,
        default: Date.now,
    },
    
    // When the bot was started
    startedAt: {
        type: Date,
        default: null,
    },
    
    // Lavalink connection status
    lavalinkConnected: {
        type: Boolean,
        default: false,
    },
    
    // Connected Lavalink node ID
    connectedNodeId: {
        type: String,
        default: null,
    },
    
    // Error message if status is 'Error'
    errorMessage: {
        type: String,
        default: null,
    },
    
}, {
    timestamps: true, // Adds createdAt and updatedAt
});

// Index for quick status lookups
BotStatusSchema.index({ status: 1, isMain: -1 });
BotStatusSchema.index({ lastHeartbeat: 1 });

// Static method to find available bots with priority order
BotStatusSchema.statics.findAvailableBots = function() {
    return this.find({ status: 'Available' })
        .sort({ isMain: -1, playerCount: 1 }) // Main bot first, then least loaded
        .exec();
};

// Static method to update heartbeat
BotStatusSchema.statics.updateHeartbeat = async function(botId, metrics = {}) {
    return this.findByIdAndUpdate(
        botId,
        {
            $set: {
                lastHeartbeat: new Date(),
                ...metrics,
            }
        },
        { upsert: true, new: true }
    );
};

// Static method to mark bot as offline if heartbeat is stale
BotStatusSchema.statics.markStaleBotsOffline = async function(staleThreshold = 60000) {
    const staleTime = new Date(Date.now() - staleThreshold);
    return this.updateMany(
        {
            lastHeartbeat: { $lt: staleTime },
            status: { $nin: ['Offline', 'Error'] }
        },
        {
            $set: { status: 'Offline' }
        }
    );
};

// Instance method to update player count
BotStatusSchema.methods.incrementPlayerCount = async function() {
    this.playerCount += 1;
    if (this.status === 'Available' && this.playerCount > 0) {
        this.status = 'InUse';
    }
    return this.save();
};

BotStatusSchema.methods.decrementPlayerCount = async function() {
    this.playerCount = Math.max(0, this.playerCount - 1);
    if (this.status === 'InUse' && this.playerCount === 0) {
        this.status = 'Available';
    }
    return this.save();
};

export default models.BotStatus || model('BotStatus', BotStatusSchema);
