const startTime = Date.now();

const UTILITY_COMMANDS = new Set([
  "ping", "uptime", "avatar", "av", "banner",
  "serverinfo", "si", "userinfo", "ui", "roleinfo",
  "emojis", "membercount", "mc",
]);

export { UTILITY_COMMANDS };

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}

/**
 * @param {import("discord.js").Message} message
 * @param {import("discord.js").Client} client
 * @param {string} cmd
 * @param {string} args
 */
export async function handleUtilityCommand(message, client, cmd, args) {
  const send = (content) => message.channel.send({ content }).catch(() => {});
  const sendEmbed = (embed) => message.channel.send({ embeds: [embed] }).catch(() => {});

  switch (cmd) {
    case "ping": {
      const ws = client.ws.ping;
      const start = Date.now();
      const msg = await message.channel.send("Pinging...");
      const rtt = Date.now() - start;
      await msg.edit({ content: "", embeds: [{
        color: 0x57f287,
        title: "🏓 Pong!",
        fields: [
          { name: "Bot Latency", value: `${rtt}ms`, inline: true },
          { name: "WebSocket", value: `${ws}ms`, inline: true },
        ],
      }] }).catch(() => {});
      return;
    }

    case "uptime": {
      const uptime = Date.now() - startTime;
      return sendEmbed({
        color: 0x57f287,
        description: `⏱️ Uptime: **${formatUptime(uptime)}**`,
      });
    }

    case "avatar":
    case "av": {
      const target = message.mentions?.users?.first() || message.author;
      const url = target.displayAvatarURL({ size: 1024, dynamic: true });
      return sendEmbed({
        color: 0x5865f2,
        title: `${target.username}'s Avatar`,
        image: { url },
        url,
      });
    }

    case "banner": {
      const target = message.mentions?.users?.first() || message.author;
      try {
        const fetched = await client.users.fetch(target.id, { force: true });
        const bannerUrl = fetched.bannerURL({ size: 1024, dynamic: true });
        if (!bannerUrl) return send(`${target.username} doesn't have a banner.`);
        return sendEmbed({
          color: 0x5865f2,
          title: `${target.username}'s Banner`,
          image: { url: bannerUrl },
          url: bannerUrl,
        });
      } catch {
        return send("Couldn't fetch banner.");
      }
    }

    case "serverinfo":
    case "si": {
      const guild = message.guild;
      if (!guild) return send("Use this in a server.");
      const owner = await guild.fetchOwner().catch(() => null);
      const channels = guild.channels.cache;
      const textCount = channels.filter((c) => c.isTextBased() && !c.isThread()).size;
      const voiceCount = channels.filter((c) => c.isVoiceBased()).size;
      const created = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;
      return sendEmbed({
        color: 0x5865f2,
        title: guild.name,
        thumbnail: guild.iconURL({ size: 256, dynamic: true }) ? { url: guild.iconURL({ size: 256, dynamic: true }) } : undefined,
        fields: [
          { name: "Owner", value: owner ? `${owner.user.username}` : "Unknown", inline: true },
          { name: "Members", value: `${guild.memberCount}`, inline: true },
          { name: "Created", value: created, inline: true },
          { name: "Channels", value: `💬 ${textCount} text · 🔊 ${voiceCount} voice`, inline: true },
          { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
          { name: "Boosts", value: `${guild.premiumSubscriptionCount || 0} (Tier ${guild.premiumTier})`, inline: true },
          { name: "Emojis", value: `${guild.emojis.cache.size}`, inline: true },
          { name: "ID", value: `\`${guild.id}\``, inline: true },
        ],
      });
    }

    case "userinfo":
    case "ui": {
      const target = message.mentions?.users?.first() || message.author;
      const member = message.guild ? await message.guild.members.fetch(target.id).catch(() => null) : null;
      const created = `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`;
      const fields = [
        { name: "ID", value: `\`${target.id}\``, inline: true },
        { name: "Created", value: created, inline: true },
      ];
      if (member) {
        fields.push({ name: "Joined", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true });
        const roles = member.roles.cache.filter((r) => r.id !== message.guild.id).map((r) => `${r}`).slice(0, 15);
        if (roles.length > 0) fields.push({ name: `Roles (${roles.length})`, value: roles.join(" "), inline: false });
      }
      return sendEmbed({
        color: member?.displayColor || 0x5865f2,
        title: target.tag || target.username,
        thumbnail: { url: target.displayAvatarURL({ size: 256, dynamic: true }) },
        fields,
      });
    }

    case "roleinfo": {
      if (!message.guild) return send("Use this in a server.");
      const roleMention = message.mentions?.roles?.first();
      const roleName = args.trim().toLowerCase();
      const role = roleMention || message.guild.roles.cache.find((r) => r.name.toLowerCase() === roleName);
      if (!role) return send("Usage: `!roleinfo <@role or role name>`");
      return sendEmbed({
        color: role.color || 0x99aab5,
        title: `Role: ${role.name}`,
        fields: [
          { name: "ID", value: `\`${role.id}\``, inline: true },
          { name: "Color", value: `#${role.color.toString(16).padStart(6, "0")}`, inline: true },
          { name: "Members", value: `${role.members.size}`, inline: true },
          { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
          { name: "Hoisted", value: role.hoist ? "Yes" : "No", inline: true },
          { name: "Position", value: `${role.position}`, inline: true },
          { name: "Created", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
        ],
      });
    }

    case "emojis": {
      if (!message.guild) return send("Use this in a server.");
      const emojis = message.guild.emojis.cache;
      if (emojis.size === 0) return send("This server has no custom emojis.");
      const list = emojis.map((e) => `${e}`).join(" ");
      const trimmed = list.length > 2000 ? list.slice(0, 1997) + "..." : list;
      return sendEmbed({
        color: 0x5865f2,
        title: `Emojis (${emojis.size})`,
        description: trimmed,
      });
    }

    case "membercount":
    case "mc": {
      if (!message.guild) return send("Use this in a server.");
      return sendEmbed({
        color: 0x5865f2,
        description: `👥 **${message.guild.name}** has **${message.guild.memberCount}** members`,
      });
    }

    default:
      return;
  }
}
