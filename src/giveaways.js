import { createStore } from "./storage.js";
import { randomBytes } from "crypto";
import { parseTime, formatMs } from "./reminders.js";

const store = createStore("giveaways.json", () => []);

/** @type {Map<string, NodeJS.Timeout>} */
const giveawayTimers = new Map();
let discordClient = null;

export function initGiveaways(client) {
  discordClient = client;
  const giveaways = store.load();
  const now = Date.now();
  for (const g of giveaways) {
    if (g.ended) continue;
    if (g.endsAt <= now) {
      endGiveaway(g.id);
    } else {
      scheduleEnd(g);
    }
  }
  console.log(`Giveaways: ${giveaways.filter((g) => !g.ended).length} active.`);
}

function scheduleEnd(giveaway) {
  const delay = Math.max(1000, giveaway.endsAt - Date.now());
  const timeout = setTimeout(() => endGiveaway(giveaway.id), delay);
  giveawayTimers.set(giveaway.id, timeout);
}

/**
 * Start a new giveaway.
 * @param {import("discord.js").Message} message
 * @param {string} args - "<duration> <prize>"
 */
export async function startGiveaway(message, args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    return message.channel.send({ content: "Usage: `!giveaway <duration> <prize>`\nExample: `!giveaway 1h Free Nitro`" }).catch(() => {});
  }

  const timeStr = parts[0];
  const ms = parseTime(timeStr);
  if (!ms || ms < 10_000) {
    return message.channel.send({ content: "Invalid duration. Use: `30s`, `5m`, `2h`, `1d`" }).catch(() => {});
  }
  if (ms > 14 * 86_400_000) {
    return message.channel.send({ content: "Maximum giveaway duration is 14 days." }).catch(() => {});
  }

  const prize = parts.slice(1).join(" ");
  const endsAt = Date.now() + ms;

  const msg = await message.channel.send({
    embeds: [{
      color: 0xfee75c,
      title: "🎉 GIVEAWAY 🎉",
      description: `**${prize}**\n\nReact with 🎉 to enter!\nEnds: <t:${Math.floor(endsAt / 1000)}:R>`,
      footer: { text: `Hosted by ${message.author.username}` },
      timestamp: new Date(endsAt).toISOString(),
    }],
  }).catch(() => null);

  if (!msg) return;
  await msg.react("🎉").catch(() => {});

  const giveaway = {
    id: randomBytes(4).toString("hex"),
    messageId: msg.id,
    channelId: message.channel.id,
    guildId: message.guildId,
    prize,
    hostId: message.author.id,
    endsAt,
    ended: false,
    winnerId: null,
  };

  const all = store.load();
  all.push(giveaway);
  store.save(all);
  scheduleEnd(giveaway);
}

/**
 * End a giveaway and pick a winner.
 */
export async function endGiveaway(giveawayId) {
  const all = store.load();
  const g = all.find((x) => x.id === giveawayId);
  if (!g || g.ended) return;

  g.ended = true;
  store.save(all);

  const timer = giveawayTimers.get(giveawayId);
  if (timer) { clearTimeout(timer); giveawayTimers.delete(giveawayId); }

  if (!discordClient) return;

  try {
    const channel = await discordClient.channels.fetch(g.channelId).catch(() => null);
    if (!channel) return;

    const msg = await channel.messages.fetch(g.messageId).catch(() => null);
    if (!msg) return;

    const reaction = msg.reactions.cache.get("🎉");
    if (!reaction) {
      await channel.send({ embeds: [{ color: 0xed4245, description: `🎉 Giveaway for **${g.prize}** ended — no participants!` }] }).catch(() => {});
      return;
    }

    const users = await reaction.users.fetch();
    const eligible = users.filter((u) => !u.bot);

    if (eligible.size === 0) {
      await channel.send({ embeds: [{ color: 0xed4245, description: `🎉 Giveaway for **${g.prize}** ended — no participants!` }] }).catch(() => {});
      return;
    }

    const winner = eligible.random();
    g.winnerId = winner.id;
    store.save(all);

    await msg.edit({
      embeds: [{
        color: 0x57f287,
        title: "🎉 GIVEAWAY ENDED 🎉",
        description: `**${g.prize}**\n\nWinner: <@${winner.id}> 🎊`,
        footer: { text: `${eligible.size} participant(s)` },
      }],
    }).catch(() => {});

    await channel.send({
      content: `<@${winner.id}>`,
      embeds: [{
        color: 0x57f287,
        description: `🎉 Congratulations <@${winner.id}>! You won **${g.prize}**!`,
      }],
    }).catch(() => {});
  } catch (e) {
    console.error("Giveaway end failed:", e.message);
  }
}

/**
 * Reroll a giveaway winner.
 */
export async function rerollGiveaway(message, messageId) {
  const all = store.load();
  const g = all.find((x) => x.messageId === messageId && x.guildId === message.guildId);
  if (!g) return message.channel.send({ content: "Giveaway not found." }).catch(() => {});
  if (!g.ended) return message.channel.send({ content: "This giveaway hasn't ended yet." }).catch(() => {});

  try {
    const channel = await discordClient.channels.fetch(g.channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(g.messageId).catch(() => null);
    if (!msg) return message.channel.send({ content: "Original giveaway message not found." }).catch(() => {});

    const reaction = msg.reactions.cache.get("🎉");
    const users = reaction ? await reaction.users.fetch() : null;
    const eligible = users?.filter((u) => !u.bot);

    if (!eligible || eligible.size === 0) {
      return message.channel.send({ content: "No eligible participants to reroll." }).catch(() => {});
    }

    const winner = eligible.random();
    g.winnerId = winner.id;
    store.save(all);

    await message.channel.send({
      content: `<@${winner.id}>`,
      embeds: [{
        color: 0x57f287,
        description: `🎉 New winner: <@${winner.id}> wins **${g.prize}**!`,
      }],
    }).catch(() => {});
  } catch (e) {
    return message.channel.send({ content: `Error: ${e.message}` }).catch(() => {});
  }
}
