import pkg from 'mongoose';
const { Schema, model, models } = pkg;

/**
 * Guild Assignment Schema
 * Tracks which bot is assigned to handle music for each guild
 */
const GuildAssignmentSchema = new Schema({
    // Guild ID as the primary key
    _id: {
        type: String,
        required: true,
    },
    
    // The bot ID assigned to this guild (e.g., "bot-1")
    assignedBotId: {
        type: String,
        required: true,
        index: true,
    },
    
    // The Discord client ID of the assigned bot
    assignedClientId: {
        type: String,
        required: true,
    },
    
    // Voice channel ID where the bot is connected (null if not in voice)
    voiceChannelId: {
        type: String,
        default: null,
    },
    
    // Text channel ID for player messages
    textChannelId: {
        type: String,
        default: null,
    },
    
    // Whether the assignment is currently active (bot in voice)
    isActive: {
        type: Boolean,
        default: false,
    },
    
    // When the assignment was made
    assignedAt: {
        type: Date,
        default: Date.now,
    },
    
    // Last activity timestamp (command usage, track change, etc.)
    lastActivity: {
        type: Date,
        default: Date.now,
    },
    
    // Reason for assignment
    assignmentReason: {
        type: String,
        enum: ['auto', 'manual', 'failover', 'priority'],
        default: 'auto',
    },
    
    // Previous bot ID (for failover tracking)
    previousBotId: {
        type: String,
        default: null,
    },
    
}, {
    timestamps: true,
});

// Index for finding active assignments
GuildAssignmentSchema.index({ isActive: 1, assignedBotId: 1 });
GuildAssignmentSchema.index({ lastActivity: 1 });

// Static method to get or create assignment for a guild
GuildAssignmentSchema.statics.getOrCreateAssignment = async function(guildId, botId, clientId, reason = 'auto') {
    let assignment = await this.findById(guildId);
    
    if (!assignment) {
        assignment = await this.create({
            _id: guildId,
            assignedBotId: botId,
            assignedClientId: clientId,
            assignmentReason: reason,
        });
    }
    
    return assignment;
};

// Static method to find guilds assigned to a specific bot
GuildAssignmentSchema.statics.findByBot = function(botId, activeOnly = false) {
    const query = { assignedBotId: botId };
    if (activeOnly) {
        query.isActive = true;
    }
    return this.find(query).exec();
};

// Static method to count active assignments per bot
GuildAssignmentSchema.statics.countActiveByBot = function(botId) {
    return this.countDocuments({ assignedBotId: botId, isActive: true });
};

// Static method to reassign guild to a different bot
GuildAssignmentSchema.statics.reassignGuild = async function(guildId, newBotId, newClientId, reason = 'failover') {
    const assignment = await this.findById(guildId);
    
    if (assignment) {
        assignment.previousBotId = assignment.assignedBotId;
        assignment.assignedBotId = newBotId;
        assignment.assignedClientId = newClientId;
        assignment.assignmentReason = reason;
        assignment.assignedAt = new Date();
        return assignment.save();
    }
    
    // Create new assignment if none exists
    return this.create({
        _id: guildId,
        assignedBotId: newBotId,
        assignedClientId: newClientId,
        assignmentReason: reason,
    });
};

// Static method to release inactive assignments after timeout
GuildAssignmentSchema.statics.releaseInactiveAssignments = async function(inactiveThreshold = 300000) {
    const inactiveTime = new Date(Date.now() - inactiveThreshold);
    return this.updateMany(
        {
            isActive: true,
            lastActivity: { $lt: inactiveTime }
        },
        {
            $set: { isActive: false }
        }
    );
};

// Instance method to activate assignment (bot joined voice)
GuildAssignmentSchema.methods.activate = async function(voiceChannelId, textChannelId) {
    this.isActive = true;
    this.voiceChannelId = voiceChannelId;
    this.textChannelId = textChannelId;
    this.lastActivity = new Date();
    return this.save();
};

// Instance method to deactivate assignment (bot left voice)
GuildAssignmentSchema.methods.deactivate = async function() {
    this.isActive = false;
    this.voiceChannelId = null;
    this.lastActivity = new Date();
    return this.save();
};

// Instance method to update last activity
GuildAssignmentSchema.methods.touch = async function() {
    this.lastActivity = new Date();
    return this.save();
};

export default models.GuildAssignment || model('GuildAssignment', GuildAssignmentSchema);
