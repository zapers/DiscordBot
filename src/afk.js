/** @type {Map<string, { reason: string, timestamp: number }>} */
const afkUsers = new Map();

/**
 * Set a user as AFK.
 * @param {string} guildUserId - "guildId:userId"
 * @param {string} reason
 */
export function setAfk(guildId, userId, reason) {
  afkUsers.set(`${guildId}:${userId}`, { reason: reason || "AFK", timestamp: Date.now() });
}

/**
 * Remove AFK status. Returns the AFK entry if they were AFK, null otherwise.
 */
export function removeAfk(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const entry = afkUsers.get(key);
  if (!entry) return null;
  afkUsers.delete(key);
  return entry;
}

/**
 * Check if a user is AFK.
 */
export function getAfk(guildId, userId) {
  return afkUsers.get(`${guildId}:${userId}`) || null;
}

/**
 * Check mentions in a message and notify about AFK users.
 * Also removes AFK if the author sends a message.
 * @param {import("discord.js").Message} message
 */
export async function handleAfkCheck(message) {
  if (message.author.bot || !message.guildId) return;

  // If the author was AFK, remove them
  const wasAfk = removeAfk(message.guildId, message.author.id);
  if (wasAfk) {
    const duration = Math.floor((Date.now() - wasAfk.timestamp) / 1000);
    const fmt = duration < 60 ? `${duration}s` : duration < 3600 ? `${Math.floor(duration / 60)}m` : `${Math.floor(duration / 3600)}h`;
    message.channel.send({
      embeds: [{
        color: 0x57f287,
        description: `👋 Welcome back <@${message.author.id}>! You were AFK for **${fmt}**.`,
      }],
    }).catch(() => {});
  }

  // Check if anyone mentioned is AFK
  if (!message.mentions?.users?.size) return;
  for (const [id, user] of message.mentions.users) {
    const afk = getAfk(message.guildId, id);
    if (afk) {
      const ago = Math.floor((Date.now() - afk.timestamp) / 1000);
      const fmt = ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.floor(ago / 60)}m ago` : `${Math.floor(ago / 3600)}h ago`;
      message.channel.send({
        embeds: [{
          color: 0xfee75c,
          description: `💤 **${user.username}** is AFK: ${afk.reason} *(${fmt})*`,
        }],
      }).catch(() => {});
    }
  }
}
