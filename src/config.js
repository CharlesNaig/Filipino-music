import dotenv from "dotenv";
dotenv.config();

/**
 * Helper function to parse bot configurations from environment variables
 * Supports BOT1_TOKEN, BOT2_TOKEN, etc.
 * @returns {Array} Array of bot configurations
 */
function parseBotConfigs() {
  const bots = [];
  let i = 1;
  
  // Keep checking for BOT{n}_TOKEN until we don't find one
  while (process.env[`BOT${i}_TOKEN`]) {
    const token = process.env[`BOT${i}_TOKEN`];
    const clientId = process.env[`BOT${i}_CLIENT_ID`];
    const name = process.env[`BOT${i}_NAME`] || `Bot-${i}`;
    
    if (token && clientId) {
      bots.push({
        id: `bot-${i}`,
        token,
        clientId,
        name,
        isMain: i === 1, // First bot is always the main bot
      });
    }
    i++;
  }
  
  // Fallback to single bot config if no BOT1_TOKEN found
  if (bots.length === 0 && process.env.TOKEN) {
    bots.push({
      id: 'bot-1',
      token: process.env.TOKEN,
      clientId: process.env.CLIENT_ID || '',
      name: process.env.BOT_NAME || 'MusicBot',
      isMain: true,
    });
  }
  
  return bots;
}

/**
 * Helper function to parse Lavalink node configurations
 * Supports LAVALINK_HOST_1, LAVALINK_PORT_1, etc.
 * @returns {Array} Array of Lavalink node configurations
 */
function parseLavalinkNodes() {
  const nodes = [];
  let i = 1;
  
  // Keep checking for LAVALINK_HOST_{n} until we don't find one
  while (process.env[`LAVALINK_HOST_${i}`]) {
    nodes.push({
      id: `node-${i}`,
      host: process.env[`LAVALINK_HOST_${i}`],
      port: parseInt(process.env[`LAVALINK_PORT_${i}`] || '2333', 10),
      authorization: process.env[`LAVALINK_PASSWORD_${i}`] || 'youshallnotpass',
      secure: process.env[`LAVALINK_SECURE_${i}`] === 'true',
      retryAmount: parseInt(process.env[`LAVALINK_RETRY_AMOUNT_${i}`] || '5', 10),
      retryDelay: parseInt(process.env[`LAVALINK_RETRY_DELAY_${i}`] || '3000', 10),
    });
    i++;
  }
  
  // Fallback to single node config if no LAVALINK_HOST_1 found
  if (nodes.length === 0) {
    nodes.push({
      id: 'node-1',
      host: process.env.LAVALINK_HOST || 'localhost',
      port: parseInt(process.env.LAVALINK_PORT || '2333', 10),
      authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE === 'true',
      retryAmount: 5,
      retryDelay: 3000,
    });
  }
  
  return nodes;
}

export const config = {
  // Legacy single-bot config (kept for backward compatibility)
  token: process.env.TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  
  // Multi-bot configuration
  bots: parseBotConfigs(),
  
  // Shared settings
  prefix: process.env.PREFIX || "!",
  ownerID: process.env.OWNER_ID ? process.env.OWNER_ID.split(",") : [],
  mongourl: process.env.MONGO_URL || "",
  
  // Colors
  color: {
    default: process.env.DEFAULT_COLOR || "#5865F2",
    error: process.env.ERROR_COLOR || "#ED4245",
    success: process.env.SUCCESS_COLOR || "#57F287",
    info: process.env.INFO_COLOR || "#5865F2",
    warn: process.env.WARN_COLOR || "#FEE75C",
  },
  
  production: process.env.PRODUCTION === "true",
  guildId: process.env.GUILD_ID || "",

  // Emojis
  emojis: {
    unicode: {
      success: "✅",
      error: "❌",
      loading: "⏳",
      music: "🎵",
      queue: "📜",
      volume: "🔊",
      pause: "⏸️",
      play: "▶️",
      stop: "⏹️",
      skip: "⏭️",
      previous: "⏮️",
      loop: "🔁",
      shuffle: "🔀",
    },
    custom: {
      success: "<:success:1088218117537123860>",
      error: "<:error:1088218120341248074>",
    },
  },

  // Images
  images: {
    banner: process.env.BANNER_IMAGE || "https://i.imgur.com/5BFecvA.png",
    thumbnail: process.env.THUMBNAIL_IMAGE || "https://i.imgur.com/AfFp7pu.png",
  },

  // Lavalink Configuration
  lavalink: {
    nodes: parseLavalinkNodes(),
    // Default search platform (youtube, youtubemusic, soundcloud, spotify, etc.)
    defaultSearchPlatform: process.env.DEFAULT_SEARCH_PLATFORM || "youtube",
    // Session resuming settings
    resuming: {
      enabled: process.env.LAVALINK_RESUME_ENABLED !== "false", // Default true
      timeout: parseInt(process.env.LAVALINK_RESUME_TIMEOUT || "60000", 10), // 60 seconds
      key: process.env.LAVALINK_RESUME_KEY || null, // Auto-generated if null
    },
    // Player default settings
    playerDefaults: {
      volume: parseInt(process.env.DEFAULT_VOLUME || "80", 10),
      autoPlay: process.env.AUTO_PLAY === "true",
      selfDeaf: true,
    },
  },

  // Load Balancing Configuration
  loadBalancing: {
    enabled: process.env.LOAD_BALANCING_ENABLED !== "false", // Default true
    // Strategy: "priority" (Main Bot first) or "roundRobin"
    strategy: process.env.LOAD_BALANCING_STRATEGY || "priority",
    // How often to check bot status (in ms)
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || "30000", 10),
    // Max players per bot before failover
    maxPlayersPerBot: parseInt(process.env.MAX_PLAYERS_PER_BOT || "100", 10),
  },

  // Links
  links: {
    support: process.env.SUPPORT_SERVER || "https://discord.gg/yourserver",
    invite: process.env.INVITE_LINK || "https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands",
    website: process.env.WEBSITE || "https://yourbotwebsite.com",
  },
};
