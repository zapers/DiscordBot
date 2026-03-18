import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import play from "play-dl";

/** @type {Map<string, MusicQueue>} */
const queues = new Map();
let spotifyReady = false;

/**
 * Initialise play-dl Spotify support if credentials are available.
 */
export async function initMusic() {
  const spotifyId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const spotifySecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (spotifyId && spotifySecret) {
    try {
      await play.setToken({
        spotify: { client_id: spotifyId, client_secret: spotifySecret, refresh_token: "", market: "US" },
      });
      spotifyReady = true;
      console.log("Spotify support enabled for music playback.");
    } catch (e) {
      console.warn("Spotify token setup failed:", e.message);
    }
  } else {
    console.log("Music: Spotify credentials not set — YouTube/SoundCloud only.");
  }
}

export function getQueue(guildId) {
  return queues.get(guildId) || null;
}

export class MusicQueue {
  constructor(guildId, voiceChannel, textChannel) {
    this.guildId = guildId;
    this.textChannel = textChannel;
    this.songs = [];
    this.current = null;
    this.volume = 50;
    this.loop = "off"; // off | song | queue
    this.playing = false;
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    this.connection.subscribe(this.player);
    this._setupListeners();
    queues.set(guildId, this);
  }

  _setupListeners() {
    this.player.on(AudioPlayerStatus.Idle, () => this._onIdle());
    this.player.on("error", (err) => {
      console.error("Audio player error:", err.message);
      this._onIdle();
    });
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  _onIdle() {
    if (this.loop === "song" && this.current) {
      this.songs.unshift(this.current);
    } else if (this.loop === "queue" && this.current) {
      this.songs.push(this.current);
    }
    this.current = null;
    this.playing = false;
    if (this.songs.length > 0) {
      this.processQueue();
    } else {
      this._autoLeaveTimeout = setTimeout(() => {
        if (!this.playing && this.songs.length === 0) {
          this.textChannel.send({ embeds: [{ color: 0x99aab5, description: "⏹️ Queue empty — leaving voice channel." }] }).catch(() => {});
          this.destroy();
        }
      }, 120_000);
    }
  }

  async processQueue() {
    if (this._autoLeaveTimeout) clearTimeout(this._autoLeaveTimeout);
    if (this.songs.length === 0) { this.playing = false; return; }
    const song = this.songs.shift();
    this.current = song;
    try {
      const stream = await play.stream(song.url);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume / 100);
      this.player.play(resource);
      this.playing = true;
    } catch (e) {
      console.error("Failed to stream:", song.url, e.message);
      this.textChannel.send({ embeds: [{ color: 0xed4245, description: `❌ Failed to play **${song.title}**: ${e.message}` }] }).catch(() => {});
      this.current = null;
      this.processQueue();
    }
  }

  enqueue(song) {
    this.songs.push(song);
    if (!this.playing && !this.current) this.processQueue();
  }

  skip() {
    this.player.stop(true);
  }

  pause() {
    this.player.pause();
  }

  resume() {
    this.player.unpause();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(150, vol));
    // Volume applies to next song; current resource volume can be adjusted if available
  }

  shuffle() {
    for (let i = this.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
    }
  }

  remove(index) {
    if (index < 0 || index >= this.songs.length) return null;
    return this.songs.splice(index, 1)[0];
  }

  destroy() {
    if (this._autoLeaveTimeout) clearTimeout(this._autoLeaveTimeout);
    this.songs = [];
    this.current = null;
    this.playing = false;
    try { this.player.stop(true); } catch {}
    try { this.connection.destroy(); } catch {}
    queues.delete(this.guildId);
  }
}

/**
 * Search/resolve a song from a URL or search query.
 * @param {string} query - URL or search terms
 * @returns {Promise<{url: string, title: string, duration: string, thumbnail?: string} | null>}
 */
export async function resolveSong(query) {
  query = query.trim();
  const urlType = await play.validate(query);

  // Direct YouTube URL
  if (urlType === "yt_video") {
    const info = await play.video_info(query);
    return {
      url: info.video_details.url,
      title: info.video_details.title || "Unknown",
      duration: info.video_details.durationRaw || "?",
      thumbnail: info.video_details.thumbnails?.[0]?.url,
    };
  }

  // YouTube playlist
  if (urlType === "yt_playlist") {
    const playlist = await play.playlist_info(query, { incomplete: true });
    const videos = await playlist.all_videos();
    return videos.map((v) => ({
      url: v.url,
      title: v.title || "Unknown",
      duration: v.durationRaw || "?",
      thumbnail: v.thumbnails?.[0]?.url,
    }));
  }

  // Spotify track
  if (urlType === "sp_track") {
    if (!spotifyReady) return null;
    const sp = await play.spotify(query);
    const searched = await play.search(`${sp.name} ${sp.artists?.[0]?.name || ""}`, { limit: 1 });
    if (searched.length === 0) return null;
    return {
      url: searched[0].url,
      title: `${sp.name} — ${sp.artists?.map((a) => a.name).join(", ") || "Unknown"}`,
      duration: searched[0].durationRaw || "?",
      thumbnail: sp.thumbnail?.url,
    };
  }

  // Spotify playlist/album
  if (urlType === "sp_playlist" || urlType === "sp_album") {
    if (!spotifyReady) return null;
    const sp = await play.spotify(query);
    const tracks = await sp.all_tracks();
    const results = [];
    for (const track of tracks.slice(0, 50)) {
      try {
        const searched = await play.search(`${track.name} ${track.artists?.[0]?.name || ""}`, { limit: 1 });
        if (searched.length > 0) {
          results.push({
            url: searched[0].url,
            title: `${track.name} — ${track.artists?.map((a) => a.name).join(", ") || "Unknown"}`,
            duration: searched[0].durationRaw || "?",
            thumbnail: track.thumbnail?.url,
          });
        }
      } catch {}
    }
    return results.length > 0 ? results : null;
  }

  // SoundCloud
  if (urlType === "so_track") {
    const info = await play.soundcloud(query);
    return {
      url: info.url,
      title: info.name || "Unknown",
      duration: info.durationInSec ? formatDuration(info.durationInSec) : "?",
      thumbnail: info.thumbnail,
    };
  }

  // Search YouTube
  const searched = await play.search(query, { limit: 1 });
  if (searched.length === 0) return null;
  return {
    url: searched[0].url,
    title: searched[0].title || "Unknown",
    duration: searched[0].durationRaw || "?",
    thumbnail: searched[0].thumbnails?.[0]?.url,
  };
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
