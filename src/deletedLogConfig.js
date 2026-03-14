import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDataDir } from "./dataDir.js";

function getConfigPath() {
  return join(getDataDir(), "deleted-log-config.json");
}

/**
 * Load config: { guilds: { [guildId]: logChannelId } }
 */
function load() {
  try {
    const path = getConfigPath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load deleted-log config:", e);
  }
  return { guilds: {} };
}

function save(config) {
  try {
    const dir = getDataDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save deleted-log config:", e);
  }
}

/**
 * Get the channel ID where the bot should post deletion logs for a guild.
 * @param {string} guildId
 * @returns {string|null}
 */
export function getLogChannelForGuild(guildId) {
  const config = load();
  return config.guilds?.[guildId] ?? null;
}

/**
 * Set the log channel for a guild. Pass null to disable logging for that guild.
 * @param {string} guildId
 * @param {string|null} channelId
 */
export function setLogChannel(guildId, channelId) {
  const config = load();
  if (!config.guilds) config.guilds = {};
  if (channelId) {
    config.guilds[guildId] = channelId;
  } else {
    delete config.guilds[guildId];
  }
  save(config);
}

/**
 * Get full config for API: { guilds: { [guildId]: channelId } }
 */
export function getConfig() {
  return load();
}
