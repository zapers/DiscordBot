import { MusicQueue, getQueue, resolveSong } from "./music.js";

const MUSIC_COMMANDS = new Set([
  "play", "p", "skip", "sk", "stop", "disconnect", "dc",
  "queue", "np", "nowplaying", "pause", "resume", "volume", "vol",
  "loop", "shuffle", "remove", "seek", "clearqueue", "cq",
]);

export { MUSIC_COMMANDS };

/**
 * @param {import("discord.js").Message} message
 * @param {string} cmd
 * @param {string} args
 */
export async function handleMusicCommand(message, cmd, args) {
  const guildId = message.guildId;
  if (!guildId) return;

  const send = (text) => message.channel.send({ content: text }).catch(() => {});
  const sendEmbed = (embed) => message.channel.send({ embeds: [embed] }).catch(() => {});

  switch (cmd) {
    case "play":
    case "p": {
      const vc = message.member?.voice?.channel;
      if (!vc) return send("🔇 Join a voice channel first.");
      if (!args.trim()) return send("Usage: `!play <url or search query>`");

      const existing = getQueue(guildId);
      const queue = existing || new MusicQueue(guildId, vc, message.channel);

      await sendEmbed({ color: 0x5865f2, description: "🔍 Searching..." });

      try {
        const result = await resolveSong(args);
        if (!result) return send("❌ No results found.");

        if (Array.isArray(result)) {
          // Playlist
          for (const song of result) queue.enqueue(song);
          return sendEmbed({
            color: 0x57f287,
            title: "📋 Playlist Added",
            description: `Added **${result.length}** songs to the queue.`,
          });
        }

        queue.enqueue(result);
        if (queue.songs.length > 0 || queue.current) {
          return sendEmbed({
            color: 0x57f287,
            title: "🎵 Added to Queue",
            description: `**${result.title}** (${result.duration})`,
            thumbnail: result.thumbnail ? { url: result.thumbnail } : undefined,
            footer: { text: `Position: ${queue.songs.length}` },
          });
        }
      } catch (e) {
        console.error("Music play error:", e);
        return send(`❌ Error: ${e.message}`);
      }
      return;
    }

    case "skip":
    case "sk": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing is playing.");
      const skipped = queue.current?.title || "current song";
      queue.skip();
      return sendEmbed({ color: 0xfee75c, description: `⏭️ Skipped **${skipped}**.` });
    }

    case "stop":
    case "disconnect":
    case "dc": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing is playing.");
      queue.destroy();
      return sendEmbed({ color: 0xed4245, description: "⏹️ Stopped playback and cleared the queue." });
    }

    case "queue": {
      const queue = getQueue(guildId);
      if (!queue || (!queue.current && queue.songs.length === 0)) return send("The queue is empty.");
      let desc = "";
      if (queue.current) {
        desc += `**Now Playing:** ${queue.current.title} (${queue.current.duration})\n\n`;
      }
      if (queue.songs.length > 0) {
        const page = queue.songs.slice(0, 10);
        desc += page.map((s, i) => `\`${i + 1}.\` ${s.title} (${s.duration})`).join("\n");
        if (queue.songs.length > 10) desc += `\n\n...and ${queue.songs.length - 10} more`;
      } else {
        desc += "*No upcoming songs*";
      }
      return sendEmbed({
        color: 0x5865f2,
        title: `🎶 Queue (${queue.songs.length} songs)`,
        description: desc,
        footer: { text: `Loop: ${queue.loop} · Volume: ${queue.volume}%` },
      });
    }

    case "np":
    case "nowplaying": {
      const queue = getQueue(guildId);
      if (!queue?.current) return send("Nothing is playing.");
      return sendEmbed({
        color: 0x5865f2,
        title: "🎵 Now Playing",
        description: `**${queue.current.title}** (${queue.current.duration})`,
        thumbnail: queue.current.thumbnail ? { url: queue.current.thumbnail } : undefined,
        footer: { text: `Loop: ${queue.loop} · Volume: ${queue.volume}%` },
      });
    }

    case "pause": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing is playing.");
      queue.pause();
      return sendEmbed({ color: 0xfee75c, description: "⏸️ Paused." });
    }

    case "resume": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing is playing.");
      queue.resume();
      return sendEmbed({ color: 0x57f287, description: "▶️ Resumed." });
    }

    case "volume":
    case "vol": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing is playing.");
      const vol = parseInt(args);
      if (isNaN(vol) || vol < 0 || vol > 150) return send("Usage: `!volume <0-150>`");
      queue.setVolume(vol);
      return sendEmbed({ color: 0x5865f2, description: `🔊 Volume set to **${vol}%**` });
    }

    case "loop": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing is playing.");
      const modes = ["off", "song", "queue"];
      const current = modes.indexOf(queue.loop);
      queue.loop = modes[(current + 1) % modes.length];
      const emoji = { off: "➡️", song: "🔂", queue: "🔁" }[queue.loop];
      return sendEmbed({ color: 0x5865f2, description: `${emoji} Loop: **${queue.loop}**` });
    }

    case "shuffle": {
      const queue = getQueue(guildId);
      if (!queue || queue.songs.length < 2) return send("Not enough songs to shuffle.");
      queue.shuffle();
      return sendEmbed({ color: 0x5865f2, description: `🔀 Shuffled **${queue.songs.length}** songs.` });
    }

    case "remove": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing in queue.");
      const idx = parseInt(args) - 1;
      if (isNaN(idx)) return send("Usage: `!remove <position>`");
      const removed = queue.remove(idx);
      if (!removed) return send("Invalid position.");
      return sendEmbed({ color: 0xed4245, description: `🗑️ Removed **${removed.title}** from the queue.` });
    }

    case "clearqueue":
    case "cq": {
      const queue = getQueue(guildId);
      if (!queue) return send("Nothing in queue.");
      const count = queue.songs.length;
      queue.songs = [];
      return sendEmbed({ color: 0xed4245, description: `🗑️ Cleared **${count}** songs from the queue.` });
    }

    default:
      return;
  }
}
