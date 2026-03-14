/**
 * Build a Discord message payload from options (rich embeds like message.style / embed-generator).
 * Supports: content, embed title, description, url, color, author, footer, thumbnail, image, timestamp, fields.
 */

const DEFAULT_COLOR = 0x5865f2;

/**
 * @param {{
 *   content?: string | null;
 *   embed_title?: string | null;
 *   embed_description?: string | null;
 *   embed_color?: string | null;
 *   embed_url?: string | null;
 *   author_name?: string | null;
 *   author_icon_url?: string | null;
 *   footer_text?: string | null;
 *   footer_icon_url?: string | null;
 *   thumbnail_url?: string | null;
 *   image_url?: string | null;
 *   timestamp?: boolean;
 *   field1_name?: string | null;
 *   field1_value?: string | null;
 *   field2_name?: string | null;
 *   field2_value?: string | null;
 *   field3_name?: string | null;
 *   field3_value?: string | null;
 * }} opts
 * @returns {{ content?: string, embeds?: object[] }}
 */
export function buildMessagePayload(opts) {
  const payload = {};
  const content = opts.content?.trim();
  if (content) payload.content = content;

  const hasEmbed =
    opts.embed_title ??
    opts.embed_description ??
    opts.author_name ??
    opts.footer_text ??
    opts.thumbnail_url ??
    opts.image_url ??
    (opts.field1_name && opts.field1_value);

  if (!hasEmbed && !content) return payload;

  const colorStr = opts.embed_color;
  const color = colorStr
    ? parseInt(String(colorStr).replace(/^#/, ""), 16)
    : DEFAULT_COLOR;
  const embedColor = Number.isNaN(color) ? DEFAULT_COLOR : color;

  const fields = [];
  for (let i = 1; i <= 3; i++) {
    const name = opts[`field${i}_name`]?.trim();
    const value = opts[`field${i}_value`]?.trim();
    if (name && value) fields.push({ name, value, inline: true });
  }

  const embed = {
    title: opts.embed_title?.trim() || undefined,
    description: opts.embed_description?.trim() || undefined,
    url: opts.embed_url?.trim() || undefined,
    color: embedColor,
    timestamp: opts.timestamp ? new Date().toISOString() : undefined,
    footer:
      opts.footer_text?.trim()
        ? {
            text: opts.footer_text.trim(),
            icon_url: opts.footer_icon_url?.trim() || undefined,
          }
        : undefined,
    author:
      opts.author_name?.trim()
        ? {
            name: opts.author_name.trim(),
            icon_url: opts.author_icon_url?.trim() || undefined,
            url: undefined,
          }
        : undefined,
    thumbnail:
      opts.thumbnail_url?.trim()
        ? { url: opts.thumbnail_url.trim() }
        : undefined,
    image: opts.image_url?.trim() ? { url: opts.image_url.trim() } : undefined,
    fields: fields.length ? fields : undefined,
  };

  // Remove undefined keys so Discord doesn't complain
  const clean = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== "") out[k] = v;
    }
    return out;
  };

  payload.embeds = [clean(embed)];
  return payload;
}

/**
 * Check if options have at least content or some embed content.
 */
export function hasMessageContent(opts) {
  if (opts.content?.trim()) return true;
  if (opts.embed_title?.trim() || opts.embed_description?.trim()) return true;
  if (opts.author_name?.trim() || opts.footer_text?.trim()) return true;
  if (opts.thumbnail_url?.trim() || opts.image_url?.trim()) return true;
  for (let i = 1; i <= 3; i++) {
    if (opts[`field${i}_name`]?.trim() && opts[`field${i}_value`]?.trim())
      return true;
  }
  return false;
}
