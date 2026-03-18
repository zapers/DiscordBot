const REACTION_LETTERS = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];

/**
 * Create a poll in a channel.
 * @param {import("discord.js").Message} message
 * @param {string} args - "Question | Option 1 | Option 2 | ..."
 */
export async function createPoll(message, args) {
  const parts = args.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return message.channel.send({ content: "Usage: `!poll Question | Option 1 | Option 2 | ...` (2–10 options)" }).catch(() => {});
  }

  const question = parts[0];
  const options = parts.slice(1, 11); // Max 10

  const description = options.map((opt, i) => `${REACTION_LETTERS[i]} ${opt}`).join("\n\n");

  const msg = await message.channel.send({
    embeds: [{
      color: 0x5865f2,
      title: `📊 ${question}`,
      description,
      footer: { text: `Poll by ${message.author.username} · React to vote!` },
      timestamp: new Date().toISOString(),
    }],
  }).catch(() => null);

  if (!msg) return;

  for (let i = 0; i < options.length; i++) {
    await msg.react(REACTION_LETTERS[i]).catch(() => {});
  }
}
