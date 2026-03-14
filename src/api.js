import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { addSchedule, listSchedules, removeSchedule } from "./scheduler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create Express app for send/schedule API and web UI.
 * @param {import("discord.js").Client} client
 * @returns {express.Express}
 */
export function createApi(client) {
  const app = express();
  const apiKey = process.env.API_KEY;

  app.use(express.json());

  function auth(req, res, next) {
    if (!apiKey) {
      // No key set: allow only localhost (for local-only use)
      const ip = req.ip || req.socket.remoteAddress || "";
      if (ip !== "127.0.0.1" && ip !== "::1" && ip !== "::ffff:127.0.0.1") {
        return res.status(403).json({ error: "API only allowed from localhost when API_KEY is not set" });
      }
      return next();
    }
    const key = req.headers["x-api-key"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (key !== apiKey) {
      return res.status(401).json({ error: "Invalid or missing API key" });
    }
    next();
  }

  // Serve web UI
  app.use(express.static(join(__dirname, "..", "public")));

  // API routes (require auth)
  app.use("/api", auth);

  app.get("/api/channels", async (req, res) => {
    try {
      const guilds = [];
      for (const [id, guild] of client.guilds.cache) {
        const channels = [];
        for (const [cId, ch] of guild.channels.cache) {
          if (ch.isTextBased && ch.viewable) {
            channels.push({ id: cId, name: ch.name });
          }
        }
        channels.sort((a, b) => a.name.localeCompare(b.name));
        guilds.push({ id, name: guild.name, channels });
      }
      res.json({ guilds });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/send", async (req, res) => {
    const { channelId, content } = req.body || {};
    if (!channelId || content == null) {
      return res.status(400).json({ error: "channelId and content required" });
    }
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased) {
        return res.status(400).json({ error: "Channel not found or not text channel" });
      }
      await channel.send({ content: String(content).trim() || " " });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/schedule", async (req, res) => {
    const body = req.body || {};
    const { channelId, content, scheduleType } = body;
    if (!channelId || content == null || !scheduleType) {
      return res.status(400).json({
        error: "channelId, content, and scheduleType required (scheduleType: interval_minutes | daily | weekly)",
      });
    }
    const payload = { content: String(content).trim() || " " };
    const options = {
      timezone: body.timezone || "UTC",
      minutes: body.minutes ?? 1,
      time: body.time || "00:00",
      day_of_week: body.day_of_week ?? 0,
    };
    try {
      const { id, label } = addSchedule({
        channelId: String(channelId),
        payload,
        scheduleType,
        options,
      });
      res.json({ ok: true, id, label });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/schedules", (req, res) => {
    try {
      const list = listSchedules();
      res.json({ schedules: list });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/schedules/:id", (req, res) => {
    const id = req.params.id;
    const removed = removeSchedule(id);
    if (!removed) return res.status(404).json({ error: "Schedule not found" });
    res.json({ ok: true });
  });

  return app;
}
