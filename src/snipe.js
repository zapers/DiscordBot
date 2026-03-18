/**
 * Snipe system — stores the last deleted message per channel.
 * Also stores last edited message (edit-snipe).
 */

/** @type {Map<string, { content: string, author: { username: string, avatarURL: string, id: string }, timestamp: number, attachmentURL?: string }>} */
const deletedMessages = new Map();

/** @type {Map<string, { oldContent: string, newContent: string, author: { username: string, avatarURL: string, id: string }, timestamp: number }>} */
const editedMessages = new Map();

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Record a deleted message for sniping.
 * @param {import("discord.js").Message} message
 */
export function recordDeleted(message) {
  if (message.author?.bot) return;
  if (!message.content && !message.attachments?.size) return;

  deletedMessages.set(message.channelId, {
    content: message.content || "",
    author: {
      username: message.author?.username || "Unknown",
      avatarURL: message.author?.displayAvatarURL?.({ size: 64 }) || "",
      id: message.author?.id || "0",
    },
    timestamp: Date.now(),
    attachmentURL: message.attachments?.first()?.url,
  });

  // Auto-expire after MAX_AGE
  setTimeout(() => {
    const entry = deletedMessages.get(message.channelId);
    if (entry && entry.timestamp <= Date.now() - MAX_AGE_MS) {
      deletedMessages.delete(message.channelId);
    }
  }, MAX_AGE_MS);
}

/**
 * Record an edited message for edit-sniping.
 */
export function recordEdited(oldMessage, newMessage) {
  if (newMessage.author?.bot) return;
  if (!oldMessage.content || !newMessage.content) return;
  if (oldMessage.content === newMessage.content) return;

  editedMessages.set(newMessage.channelId, {
    oldContent: oldMessage.content,
    newContent: newMessage.content,
    author: {
      username: newMessage.author?.username || "Unknown",
      avatarURL: newMessage.author?.displayAvatarURL?.({ size: 64 }) || "",
      id: newMessage.author?.id || "0",
    },
    timestamp: Date.now(),
  });

  setTimeout(() => {
    const entry = editedMessages.get(newMessage.channelId);
    if (entry && entry.timestamp <= Date.now() - MAX_AGE_MS) {
      editedMessages.delete(newMessage.channelId);
    }
  }, MAX_AGE_MS);
}

/**
 * Get the last deleted message in a channel.
 */
export function getSnipe(channelId) {
  const entry = deletedMessages.get(channelId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MAX_AGE_MS) {
    deletedMessages.delete(channelId);
    return null;
  }
  return entry;
}

/**
 * Get the last edited message in a channel.
 */
export function getEditSnipe(channelId) {
  const entry = editedMessages.get(channelId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MAX_AGE_MS) {
    editedMessages.delete(channelId);
    return null;
  }
  return entry;
}
