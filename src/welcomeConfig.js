import { createStore } from "./storage.js";

const store = createStore("welcome-config.json");

/**
 * Get welcome/leave config for a guild.
 * @returns {{ welcomeChannelId?: string, welcomeMessage?: string, leaveChannelId?: string, leaveMessage?: string } | null}
 */
export function getWelcomeConfig(guildId) {
  return store.load()[guildId] || null;
}

/**
 * Set welcome message config.
 * Placeholders: {user} {username} {server} {memberCount}
 */
export function setWelcomeMessage(guildId, channelId, message) {
  const all = store.load();
  if (!all[guildId]) all[guildId] = {};
  all[guildId].welcomeChannelId = channelId;
  all[guildId].welcomeMessage = message;
  store.save(all);
}

/**
 * Set leave message config.
 */
export function setLeaveMessage(guildId, channelId, message) {
  const all = store.load();
  if (!all[guildId]) all[guildId] = {};
  all[guildId].leaveChannelId = channelId;
  all[guildId].leaveMessage = message;
  store.save(all);
}

/**
 * Disable welcome messages.
 */
export function disableWelcome(guildId) {
  const all = store.load();
  if (!all[guildId]) return;
  delete all[guildId].welcomeChannelId;
  delete all[guildId].welcomeMessage;
  if (Object.keys(all[guildId]).length === 0) delete all[guildId];
  store.save(all);
}

/**
 * Disable leave messages.
 */
export function disableLeave(guildId) {
  const all = store.load();
  if (!all[guildId]) return;
  delete all[guildId].leaveChannelId;
  delete all[guildId].leaveMessage;
  if (Object.keys(all[guildId]).length === 0) delete all[guildId];
  store.save(all);
}

/**
 * Process placeholders in a message template.
 */
function processTemplate(template, member) {
  return template
    .replace(/{user}/gi, `<@${member.id}>`)
    .replace(/{username}/gi, member.user?.username || member.displayName || "User")
    .replace(/{server}/gi, member.guild?.name || "Server")
    .replace(/{memberCount}/gi, String(member.guild?.memberCount || "?"))
    .replace(/{tag}/gi, member.user?.tag || member.user?.username || "User");
}

/**
 * Handle a new member joining.
 * @param {import("discord.js").GuildMember} member
 */
export async function handleMemberJoin(member) {
  const config = getWelcomeConfig(member.guild.id);
  if (!config?.welcomeChannelId || !config?.welcomeMessage) return;
  try {
    const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const text = processTemplate(config.welcomeMessage, member);
    await channel.send({
      embeds: [{
        color: 0x57f287,
        description: text,
        thumbnail: { url: member.user.displayAvatarURL({ size: 256, dynamic: true }) },
        footer: { text: `Member #${member.guild.memberCount}` },
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (e) {
    console.error("Welcome message failed:", e.message);
  }
}

/**
 * Handle a member leaving.
 * @param {import("discord.js").GuildMember} member
 */
export async function handleMemberLeave(member) {
  const config = getWelcomeConfig(member.guild.id);
  if (!config?.leaveChannelId || !config?.leaveMessage) return;
  try {
    const channel = await member.guild.channels.fetch(config.leaveChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const text = processTemplate(config.leaveMessage, member);
    await channel.send({
      embeds: [{
        color: 0xed4245,
        description: text,
        footer: { text: `${member.guild.memberCount} members remaining` },
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (e) {
    console.error("Leave message failed:", e.message);
  }
}
