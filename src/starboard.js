import { createStore } from "./storage.js";

const store = createStore("starboard.json");

/**
 * Get starboard config for a guild.
 * @returns {{ channelId: string, threshold: number } | null}
 */
export function getStarboardConfig(guildId) {
  const all = store.load();
  return all[guildId] || null;
}

/**
 * Set starboard config.
 */
export function setStarboardConfig(guildId, channelId, threshold = 3) {
  const all = store.load();
  all[guildId] = { channelId, threshold: Math.max(1, threshold), posted: all[guildId]?.posted || {} };
  store.save(all);
}

/**
 * Disable starboard for a guild.
 */
export function removeStarboardConfig(guildId) {
  const all = store.load();
  if (!(guildId in all)) return false;
  delete all[guildId];
  store.save(all);
  return true;
}

/**
 * Handle a message reaction add — check if it qualifies for starboard.
 * @param {import("discord.js").MessageReaction} reaction
 * @param {import("discord.js").Client} client
 */
export async function handleStarboardReaction(reaction, client) {
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.emoji.name !== "⭐") return;

  const message = reaction.message;
  if (message.partial) {
    try { await message.fetch(); } catch { return; }
  }

  const guildId = message.guildId;
  if (!guildId) return;

  const config = getStarboardConfig(guildId);
  if (!config?.channelId) return;

  // Don't starboard messages from the starboard channel itself
  if (message.channelId === config.channelId) return;

  const starCount = message.reactions.cache.get("⭐")?.count || 0;
  if (starCount < config.threshold) return;

  // Check if already posted
  const all = store.load();
  const guild = all[guildId];
  if (!guild) return;
  if (!guild.posted) guild.posted = {};

  if (guild.posted[message.id]) {
    // Update existing starboard message
    try {
      const sbChannel = await client.channels.fetch(config.channelId).catch(() => null);
      if (!sbChannel) return;
      const sbMsg = await sbChannel.messages.fetch(guild.posted[message.id]).catch(() => null);
      if (sbMsg) {
        await sbMsg.edit({
          content: `⭐ **${starCount}** | <#${message.channelId}>`,
        }).catch(() => {});
      }
    } catch {}
    return;
  }

  // Post new starboard entry
  try {
    const sbChannel = await client.channels.fetch(config.channelId).catch(() => null);
    if (!sbChannel?.isTextBased()) return;

    const content = message.content?.slice(0, 1024) || "";
    const image = message.attachments?.first()?.url;

    const embed = {
      color: 0xfee75c,
      author: {
        name: message.author?.username || "Unknown",
        icon_url: message.author?.displayAvatarURL?.({ size: 64 }),
      },
      description: content || undefined,
      fields: [
        { name: "Source", value: `[Jump to message](${message.url})`, inline: true },
      ],
      image: image ? { url: image } : undefined,
      timestamp: message.createdAt?.toISOString(),
    };

    const sbMsg = await sbChannel.send({
      content: `⭐ **${starCount}** | <#${message.channelId}>`,
      embeds: [embed],
    });

    guild.posted[message.id] = sbMsg.id;
    store.save(all);
  } catch (e) {
    console.error("Starboard post failed:", e.message);
  }
}
