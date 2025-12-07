import { Client, Routes, REST, PermissionsBitField, ApplicationCommandType, GatewayIntentBits, Partials, Collection, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } from 'discord.js';
import { readdirSync, existsSync } from 'fs';
import pkg from 'mongoose';
const { connect, set } = pkg;
import { config } from '../config.js';
import Logger from './Logger.js';

/**
 * Extended Discord.js Client for multi-bot cluster support
 * Each bot instance has its own BotClient with unique botConfig
 */
export class BotClient extends Client {
    /**
     * @param {Object} botConfig - Bot-specific configuration
     * @param {string} botConfig.id - Unique bot identifier (e.g., "bot-1")
     * @param {string} botConfig.token - Discord bot token
     * @param {string} botConfig.clientId - Discord client ID
     * @param {string} botConfig.name - Display name for this bot
     * @param {boolean} botConfig.isMain - Whether this is the main/primary bot
     */
    constructor(botConfig = null) {
        super({
            allowedMentions: {
                parse: ['users', 'roles', 'everyone'],
                repliedUser: false,
            },
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates, // REQUIRED for Lavalink
            ],
            partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User, Partials.Reaction],
        });
        
        // Multi-bot configuration
        this.botConfig = botConfig || this._getDefaultBotConfig();
        this.botId = this.botConfig.id;    //pre gising HAHAHA
        this.botName = this.botConfig.name;
        this.isMainBot = this.botConfig.isMain;
        
        // Set token from botConfig
        this.token = this.botConfig.token;
        
        // Shared configuration
        this.config = config;
        this.color = this.config.color;
        
        // Collections
        this.commands = new Collection();
        this.cooldowns = new Collection();
        this.aliases = new Collection();
        this.events = new Collection();
        
        // Lavalink manager (initialized later)
        this.lavalink = null;
        
        // Bot status tracking
        this.status = 'Starting';
        this.playerCount = 0;
        
        // Logger with bot-specific scope
        this.logger = new Logger({
            displayTimestamp: true,
            displayDate: true,
        });
        this.logger.scope = this.botName;
    }
    
    /**
     * Get default bot config from legacy single-bot configuration
     * @private
     */
    _getDefaultBotConfig() {
        // Check if bots array exists and has entries
        if (config.bots && config.bots.length > 0) {
            return config.bots[0]; // Return first bot as default
        }
        
        // Fallback to legacy config
        return {
            id: 'bot-1',
            token: config.token,
            clientId: config.clientId,
            name: 'MusicBot',
            isMain: true,
        };
    }
    
    container() {
        return new ContainerBuilder();
    }
    
    textDisplay(content) {
        return new TextDisplayBuilder().setContent(content);
    }
    
    separator(options = {}) {
        const sep = new SeparatorBuilder();
        if (options.spacing) sep.setSpacing(options.spacing);
        if (options.divider !== undefined) sep.setDivider(options.divider);
        return sep;
    }
    
    section() {
        return new SectionBuilder();
    }
    
    thumbnail(url) {
        return new ThumbnailBuilder().setURL(url);
    }
    
    async loadEvents() {
        let i = 0;
        const eventFiles = readdirSync('./src/events');
        
        for (const file of eventFiles) {
            const events = readdirSync(`./src/events/${file}`).filter(c => c.split('.').pop() === 'js');
            
            for (const event of events) {
                const Event = (await import(`../events/${file}/${event}`)).default;
                const eventClass = new Event(this, Event);
                this.events.set(eventClass.name, eventClass);
                const eventName = eventClass.name;
                
                if (eventClass.once) {
                    this.once(eventName, (...args) => eventClass.run(...args));
                } else {
                    this.on(eventName, (...args) => eventClass.run(...args));
                }
                i++;
            }
        }
        
        this.logger.event(`[${this.botName}] Loaded ${i} events`);
    }
    
    /**
     * Load Lavalink-specific events from src/events/Lavalink/
     */
    async loadLavalinkEvents() {
        const lavalinkEventsPath = './src/events/Lavalink';
        
        if (!existsSync(lavalinkEventsPath)) {
            this.logger.warn(`[${this.botName}] Lavalink events folder not found, skipping`);
            return;
        }
        
        if (!this.lavalink) {
            this.logger.warn(`[${this.botName}] Lavalink not initialized, cannot load events`);
            return;
        }
        
        let i = 0;
        const eventFiles = readdirSync(lavalinkEventsPath).filter(f => f.endsWith('.js'));
        
        for (const eventFile of eventFiles) {
            try {
                const Event = (await import(`../events/Lavalink/${eventFile}`)).default;
                const eventClass = new Event(this, Event);
                
                // Determine which emitter to use based on event type
                // Player events: trackStart, trackEnd, queueEnd, playerCreate, playerDestroy
                // Node events: nodeConnect, nodeDisconnect, nodeError, nodeReconnect
                const playerEvents = ['trackStart', 'trackEnd', 'trackStuck', 'trackError', 'queueEnd', 'playerCreate', 'playerDestroy', 'playerMove'];
                const nodeEvents = ['nodeConnect', 'nodeDisconnect', 'nodeError', 'nodeReconnect', 'nodeResumed'];
                
                if (playerEvents.includes(eventClass.name)) {
                    this.lavalink.on(eventClass.name, (...args) => eventClass.run(...args));
                } else if (nodeEvents.includes(eventClass.name)) {
                    this.lavalink.nodeManager.on(eventClass.name, (...args) => eventClass.run(...args));
                } else {
                    // Default to lavalink manager
                    this.lavalink.on(eventClass.name, (...args) => eventClass.run(...args));
                }
                
                i++;
            } catch (error) {
                this.logger.error(`[${this.botName}] Failed to load Lavalink event ${eventFile}: ${error.message}`);
            }
        }
        
        this.logger.event(`[${this.botName}] Loaded ${i} Lavalink events`);
    }
    
    async loadCommands() {
        let i = 0;
        const cmdData = [];
        const commandFiles = readdirSync('./src/commands');
        
        for (const file of commandFiles) {
            const commands = readdirSync(`./src/commands/${file}`).filter(file => file.endsWith('.js'));
            
            for (const command of commands) {
                const Command = (await import(`../commands/${file}/${command}`)).default;
                const cmd = new Command(this, Command);
                cmd.file = Command;
                cmd.fileName = Command.name;
                this.commands.set(cmd.name, cmd);
                
                if (cmd.aliases && Array.isArray(cmd.aliases)) {
                    cmd.aliases.forEach(alias => {
                        this.aliases.set(alias, cmd.name);
                    });
                }
                
                if (cmd.slashCommand) {
                    const data = {
                        name: cmd.name,
                        description: cmd.description.content,
                        type: ApplicationCommandType.ChatInput,
                        options: cmd.options ? cmd.options : null,
                        name_localizations: cmd.nameLocalizations ? cmd.nameLocalizations : null,
                        description_localizations: cmd.descriptionLocalizations ? cmd.descriptionLocalizations : null,
                    };
                    if (cmd.permissions.user.length > 0) {
                        data.default_member_permissions = cmd.permissions.user 
                            ? PermissionsBitField.resolve(cmd.permissions.user).toString() 
                            : 0;
                    }
                    cmdData.push(data);
                    i++;
                }
            }
        }
        
        // Only register slash commands if this is the main bot OR if explicitly configured
        if (this.isMainBot) {
            await this._registerSlashCommands(cmdData);
        } else {
            this.logger.cmd(`[${this.botName}] Skipping slash command registration (not main bot)`);
        }
        
        this.logger.cmd(`[${this.botName}] Successfully loaded ${this.commands.size} commands (${i} slash)`);
    }
    
    /**
     * Register slash commands with Discord API
     * @private
     */
    async _registerSlashCommands(cmdData) {
        const rest = new REST({ version: '10' }).setToken(this.botConfig.token);
        
        try {
            if (!this.config.production) {
                // Global commands (all servers)
                await rest.put(
                    Routes.applicationCommands(this.botConfig.clientId), 
                    { body: cmdData }
                );
                this.logger.cmd(`[${this.botName}] Registered ${cmdData.length} global slash commands`);
            } else {
                // Guild-specific commands (dev server only)
                await rest.put(
                    Routes.applicationGuildCommands(this.botConfig.clientId, this.config.guildId), 
                    { body: cmdData }
                );
                this.logger.cmd(`[${this.botName}] Registered ${cmdData.length} guild slash commands`);
            }
        } catch (error) {
            this.logger.error(`[${this.botName}] Failed to register slash commands: ${error.message}`);
        }
    }
    
    async connectMongodb() {
        set('strictQuery', true);
        await connect(this.config.mongourl);
        this.logger.ready(`[${this.botName}] Connected to MongoDB`);
    }
    
    /**
     * Update bot status in the database
     * @param {string} status - New status
     * @param {Object} metrics - Additional metrics to update
     */
    async updateStatus(status, metrics = {}) {
        this.status = status;
        
        try {
            const BotStatus = (await import('../schemas/BotStatus.js')).default;
            await BotStatus.updateHeartbeat(this.botId, {
                status,
                name: this.botName,
                clientId: this.botConfig.clientId,
                isMain: this.isMainBot,
                playerCount: this.playerCount,
                guildCount: this.guilds.cache.size,
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                uptime: this.uptime || 0,
                ping: this.ws.ping,
                lavalinkConnected: !!this.lavalink?.nodeManager?.nodes?.size,
                ...metrics,
            });
        } catch (error) {
            this.logger.error(`[${this.botName}] Failed to update status: ${error.message}`);
        }
    }
    
    /**
     * Start the bot client
     */
    async start() {
        // Login to Discord
        await super.login(this.token);
        
        // Connect to MongoDB (only once for the cluster)
        if (this.config.mongourl) {
            await this.connectMongodb();
        }
        
        // Load events and commands
        await this.loadEvents();
        await this.loadCommands();
        
        // Forward raw events to Lavalink (required for voice state updates)
        this.on('raw', (data) => {
            if (this.lavalink) {
                this.lavalink.sendRawData(data);
            }
        });
        
        // Update status
        await this.updateStatus('Available');
        
        this.logger.ready(`[${this.botName}] Bot started successfully`);
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        this.logger.warn(`[${this.botName}] Shutting down...`);
        
        try {
            // Update status to offline
            await this.updateStatus('Offline');
            
            // Destroy all players
            if (this.lavalink) {
                for (const player of this.lavalink.players.values()) {
                    await player.destroy();
                }
            }
            
            // Disconnect from Discord
            await this.destroy();
            
            this.logger.info(`[${this.botName}] Shutdown complete`);
        } catch (error) {
            this.logger.error(`[${this.botName}] Shutdown error: ${error.message}`);
        }
    }
}

