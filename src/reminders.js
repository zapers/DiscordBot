import { createStore } from "./storage.js";
import { randomBytes } from "crypto";
import { safeTimeout } from "./safeTimeout.js";

const store = createStore("reminders.json", () => []);

/** @type {Map<string, {clear: Function}>} */
const timers = new Map();
let discordClient = null;

const TIME_REGEX = /^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hr|hours?|d|days?)$/i;
const MAX_REMINDERS_PER_USER = 25;

function parseTime(input) {
  const match = input.match(TIME_REGEX);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase().charAt(0);
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return num * (multipliers[unit] || 60_000);
}

function formatMs(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/**
 * Initialise reminder system — restores pending reminders from disk.
 * @param {import("discord.js").Client} client
 */
export function initReminders(client) {
  discordClient = client;
  const reminders = store.load();
  const now = Date.now();
  let cleaned = false;
  for (const r of reminders) {
    if (r.fireAt <= now) {
      fireReminder(r);
      cleaned = true;
    } else {
      scheduleTimer(r);
    }
  }
  if (cleaned) {
    store.save(reminders.filter((r) => r.fireAt > now));
  }
  console.log(`Reminders: ${reminders.length} loaded.`);
}

function scheduleTimer(reminder) {
  const delay = Math.max(1000, reminder.fireAt - Date.now());
  const handle = safeTimeout(() => {
    fireReminder(reminder);
    // Remove from disk
    const all = store.load();
    store.save(all.filter((r) => r.id !== reminder.id));
    timers.delete(reminder.id);
  }, delay);
  timers.set(reminder.id, handle);
}

async function fireReminder(reminder) {
  if (!discordClient) return;
  try {
    // Try to DM the user
    const user = await discordClient.users.fetch(reminder.userId).catch(() => null);
    if (user) {
      await user.send({
        embeds: [{
          color: 0xfee75c,
          title: "⏰ Reminder!",
          description: reminder.message || "*(no message)*",
          footer: { text: `Set ${formatMs(Date.now() - (reminder.createdAt || Date.now()))} ago` },
        }],
      }).catch(() => {});
    }
    // Also send in the original channel if possible
    if (reminder.channelId) {
      const channel = await discordClient.channels.fetch(reminder.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        channel.send({
          content: `<@${reminder.userId}>`,
          embeds: [{
            color: 0xfee75c,
            description: `⏰ **Reminder:** ${reminder.message || "*(no message)*"}`,
          }],
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("Reminder fire failed:", e.message);
  }
}

/**
 * Create a reminder.
 * @returns {{ ok: boolean, error?: string, id?: string, fireAt?: number }}
 */
export function createReminder(userId, channelId, timeStr, message) {
  const ms = parseTime(timeStr);
  if (!ms) return { ok: false, error: "Invalid time. Use: `30s`, `5m`, `2h`, `1d`" };
  if (ms < 10_000) return { ok: false, error: "Minimum reminder time is 10 seconds." };
  if (ms > 30 * 86_400_000) return { ok: false, error: "Maximum reminder time is 30 days." };

  const all = store.load();
  const userReminders = all.filter((r) => r.userId === userId);
  if (userReminders.length >= MAX_REMINDERS_PER_USER) {
    return { ok: false, error: `You can have at most ${MAX_REMINDERS_PER_USER} reminders.` };
  }

  const reminder = {
    id: randomBytes(4).toString("hex"),
    userId,
    channelId,
    message: message.slice(0, 500),
    fireAt: Date.now() + ms,
    createdAt: Date.now(),
  };

  all.push(reminder);
  store.save(all);
  scheduleTimer(reminder);

  return { ok: true, id: reminder.id, fireAt: reminder.fireAt };
}

/**
 * List a user's active reminders.
 */
export function listReminders(userId) {
  return store.load().filter((r) => r.userId === userId && r.fireAt > Date.now());
}

/**
 * Cancel a reminder by ID.
 */
export function cancelReminder(userId, reminderId) {
  const all = store.load();
  const idx = all.findIndex((r) => r.id === reminderId && r.userId === userId);
  if (idx === -1) return false;
  all.splice(idx, 1);
  store.save(all);
  const timer = timers.get(reminderId);
  if (timer) { timer.clear(); timers.delete(reminderId); }
  return true;
}

export { parseTime, formatMs };
