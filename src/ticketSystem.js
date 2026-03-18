import { createStore } from "./storage.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";

const store = createStore("ticket-config.json");

/**
 * Get ticket config for a guild.
 * @returns {{ categoryId?: string, supportRoleId?: string, logChannelId?: string } | null}
 */
export function getTicketConfig(guildId) {
  return store.load()[guildId] || null;
}

/**
 * Set ticket system config.
 */
export function setTicketConfig(guildId, categoryId, supportRoleId, logChannelId) {
  const all = store.load();
  all[guildId] = { categoryId, supportRoleId, logChannelId };
  store.save(all);
}

/**
 * Open a ticket.
 * @param {import("discord.js").Message} message
 * @param {string} reason
 */
export async function openTicket(message, reason) {
  const guildId = message.guildId;
  if (!guildId) return;

  const config = getTicketConfig(guildId);
  if (!config?.categoryId) {
    return message.channel.send({
      content: "Ticket system not configured. An admin must run `/ticket-setup` first.",
    }).catch(() => {});
  }

  // Check for existing open ticket
  const ticketName = `ticket-${message.author.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const existing = message.guild.channels.cache.find(
    (c) => c.name === ticketName && c.parentId === config.categoryId
  );
  if (existing) {
    return message.channel.send({
      content: `You already have an open ticket: <#${existing.id}>`,
    }).catch(() => {});
  }

  try {
    const permissionOverwrites = [
      { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    if (config.supportRoleId) {
      permissionOverwrites.push({
        id: config.supportRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }

    const channel = await message.guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: config.categoryId,
      permissionOverwrites,
      topic: `Ticket by ${message.author.username} | ${reason || "No reason provided"}`,
    });

    await channel.send({
      embeds: [{
        color: 0x5865f2,
        title: "🎫 Ticket Opened",
        description: [
          `**Opened by:** <@${message.author.id}>`,
          `**Reason:** ${reason || "No reason provided"}`,
          "",
          "Use `!ticket close` to close this ticket.",
          config.supportRoleId ? `<@&${config.supportRoleId}> will be with you shortly.` : "A staff member will be with you shortly.",
        ].join("\n"),
        timestamp: new Date().toISOString(),
      }],
    });

    await message.channel.send({
      embeds: [{
        color: 0x57f287,
        description: `🎫 Ticket created: <#${channel.id}>`,
      }],
    }).catch(() => {});
  } catch (e) {
    console.error("Ticket creation failed:", e);
    message.channel.send({ content: `Failed to create ticket: ${e.message}` }).catch(() => {});
  }
}

/**
 * Close a ticket (archive the channel).
 * @param {import("discord.js").Message} message
 */
export async function closeTicket(message) {
  const guildId = message.guildId;
  if (!guildId) return;

  const config = getTicketConfig(guildId);
  const channel = message.channel;

  // Check if this is a ticket channel
  if (!channel.name.startsWith("ticket-")) {
    return message.channel.send({ content: "This is not a ticket channel." }).catch(() => {});
  }

  try {
    await channel.send({
      embeds: [{
        color: 0xed4245,
        description: `🔒 Ticket closed by <@${message.author.id}>. This channel will be deleted in 5 seconds.`,
      }],
    });

    // Log to log channel if configured
    if (config?.logChannelId) {
      try {
        const logChannel = await message.guild.channels.fetch(config.logChannelId).catch(() => null);
        if (logChannel?.isTextBased()) {
          // Collect some message history for the log
          const messages = await channel.messages.fetch({ limit: 100 });
          const transcript = messages
            .reverse()
            .map((m) => `[${m.createdAt.toISOString()}] ${m.author?.username || "Unknown"}: ${m.content || "(embed/attachment)"}`)
            .join("\n");

          await logChannel.send({
            embeds: [{
              color: 0x99aab5,
              title: `🎫 Ticket Closed: #${channel.name}`,
              description: `Closed by <@${message.author.id}>`,
              footer: { text: `${messages.size} messages` },
              timestamp: new Date().toISOString(),
            }],
            files: transcript.length > 0
              ? [{ attachment: Buffer.from(transcript, "utf-8"), name: `${channel.name}-transcript.txt` }]
              : undefined,
          }).catch(() => {});
        }
      } catch {}
    }

    setTimeout(() => {
      channel.delete("Ticket closed").catch(() => {});
    }, 5000);
  } catch (e) {
    message.channel.send({ content: `Failed to close ticket: ${e.message}` }).catch(() => {});
  }
}
