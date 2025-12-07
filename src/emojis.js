/**
 * Emoji configuration for the bot
 * Centralized emoji management
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const emojis = require('./emoji.json');

export default emojis;
