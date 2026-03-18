const EIGHT_BALL = [
  "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes — definitely.",
  "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.", "Yes.",
  "Signs point to yes.", "Reply hazy, try again.", "Ask again later.",
  "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
  "Don't count on it.", "My reply is no.", "My sources say no.",
  "Outlook not so good.", "Very doubtful.",
];

const RPS_CHOICES = ["rock", "paper", "scissors"];
const RPS_EMOJI = { rock: "🪨", paper: "📄", scissors: "✂️" };

const ROASTS = [
  "You're the reason the gene pool needs a lifeguard.",
  "If you were any more basic, you'd be baking soda.",
  "I'd explain it to you, but I left my crayons at home.",
  "You bring everyone so much joy… when you leave.",
  "You're proof that even evolution makes mistakes sometimes.",
  "You're like a cloud — everything brightens up when you disappear.",
  "I'd say you're funny, but looks aren't everything.",
  "You're not stupid; you just have bad luck thinking.",
];

const COMPLIMENTS = [
  "You light up the room just by being in it ✨",
  "Your smile is contagious.",
  "You've got a great sense of humor!",
  "You're braver than you believe, stronger than you seem, and smarter than you think.",
  "You have the best laugh.",
  "You're someone's reason to smile today.",
  "On a scale from 1 to 10, you're an 11.",
  "If you were a vegetable, you'd be a cute-cumber 🥒",
];

const FUN_COMMANDS = new Set([
  "8ball", "eightball", "dice", "roll", "rps",
  "choose", "pick", "rate", "ship",
  "mock", "reverse", "roast", "compliment",
  "hack", "pp", "iq", "howgay",
]);

export { FUN_COMMANDS };

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * @param {import("discord.js").Message} message
 * @param {string} cmd
 * @param {string} args
 */
export async function handleFunCommand(message, cmd, args) {
  const send = (content) => message.channel.send({ content }).catch(() => {});
  const sendEmbed = (embed) => message.channel.send({ embeds: [embed] }).catch(() => {});

  switch (cmd) {
    case "8ball":
    case "eightball": {
      if (!args.trim()) return send("Usage: `!8ball <question>`");
      return sendEmbed({
        color: 0x9b59b6,
        title: "🎱 Magic 8-Ball",
        fields: [
          { name: "Question", value: args.slice(0, 256) },
          { name: "Answer", value: `**${pick(EIGHT_BALL)}**` },
        ],
      });
    }

    case "dice":
    case "roll": {
      const sides = parseInt(args) || 6;
      const clamped = Math.min(Math.max(sides, 2), 1000);
      const result = rand(1, clamped);
      return sendEmbed({
        color: 0xe74c3c,
        description: `🎲 You rolled a **${result}** (d${clamped})`,
      });
    }

    case "rps": {
      const userChoice = args.toLowerCase().trim();
      if (!RPS_CHOICES.includes(userChoice)) return send("Usage: `!rps <rock|paper|scissors>`");
      const botChoice = pick(RPS_CHOICES);
      let result;
      if (userChoice === botChoice) result = "It's a **tie**! 🤝";
      else if (
        (userChoice === "rock" && botChoice === "scissors") ||
        (userChoice === "paper" && botChoice === "rock") ||
        (userChoice === "scissors" && botChoice === "paper")
      ) result = "You **win**! 🎉";
      else result = "You **lose**! 😢";
      return sendEmbed({
        color: 0x3498db,
        title: "Rock Paper Scissors",
        description: `${RPS_EMOJI[userChoice]} vs ${RPS_EMOJI[botChoice]}\n${result}`,
      });
    }

    case "choose":
    case "pick": {
      const options = args.split("|").map((s) => s.trim()).filter(Boolean);
      if (options.length < 2) return send("Usage: `!choose option1 | option2 | option3`");
      return sendEmbed({
        color: 0x2ecc71,
        description: `🤔 I choose: **${pick(options)}**`,
      });
    }

    case "rate": {
      if (!args.trim()) return send("Usage: `!rate <thing>`");
      const rating = rand(0, 10);
      const bar = "█".repeat(rating) + "░".repeat(10 - rating);
      return sendEmbed({
        color: 0xf39c12,
        title: `Rating: ${args.slice(0, 100)}`,
        description: `${bar} **${rating}/10**`,
      });
    }

    case "ship": {
      const mentions = message.mentions?.users;
      const users = mentions ? Array.from(mentions.values()) : [];
      let user1, user2;
      if (users.length >= 2) { user1 = users[0]; user2 = users[1]; }
      else if (users.length === 1) { user1 = message.author; user2 = users[0]; }
      else return send("Usage: `!ship @user1 @user2`");
      const pct = rand(0, 100);
      const bar = "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));
      let verdict;
      if (pct >= 90) verdict = "Soulmates! 💕";
      else if (pct >= 70) verdict = "Great match! 💖";
      else if (pct >= 50) verdict = "There's potential! 💛";
      else if (pct >= 30) verdict = "Just friends... 🤝";
      else verdict = "Not meant to be 💔";
      return sendEmbed({
        color: 0xe91e63,
        title: "💘 Ship Calculator",
        description: `**${user1.username}** × **${user2.username}**\n\n${bar} **${pct}%**\n${verdict}`,
      });
    }

    case "mock": {
      if (!args.trim()) return send("Usage: `!mock <text>`");
      const mocked = args.split("").map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join("");
      return send(mocked);
    }

    case "reverse": {
      if (!args.trim()) return send("Usage: `!reverse <text>`");
      return send(args.split("").reverse().join(""));
    }

    case "roast": {
      const target = message.mentions?.users?.first() || message.author;
      return sendEmbed({
        color: 0xe74c3c,
        description: `🔥 <@${target.id}>, ${pick(ROASTS)}`,
      });
    }

    case "compliment": {
      const target = message.mentions?.users?.first() || message.author;
      return sendEmbed({
        color: 0x2ecc71,
        description: `💝 <@${target.id}>, ${pick(COMPLIMENTS)}`,
      });
    }

    case "hack": {
      const target = message.mentions?.users?.first();
      if (!target) return send("Usage: `!hack @user`");
      const fakeIP = `${rand(1, 255)}.${rand(0, 255)}.${rand(0, 255)}.${rand(0, 255)}`;
      const fakePass = ["password123", "ilovekittens", "hunter2", "qwerty", "letmein", "admin", "abc123"][rand(0, 6)];
      return sendEmbed({
        color: 0x2ecc71,
        title: `💻 Hacking ${target.username}...`,
        description: [
          "```",
          `[▓▓▓▓▓▓▓▓▓▓] 100% Complete`,
          `IP: ${fakeIP}`,
          `Password: ${fakePass}`,
          `Browser: Probably Chrome`,
          `Last Google: "how to be cool"`,
          `Most used emoji: 💀`,
          "```",
          "*This is a joke. No actual hacking occurred.*",
        ].join("\n"),
      });
    }

    case "pp": {
      const target = message.mentions?.users?.first() || message.author;
      const size = rand(1, 15);
      return sendEmbed({
        color: 0xf39c12,
        description: `${target.username}'s pp size:\n8${"=".repeat(size)}D`,
      });
    }

    case "iq": {
      const target = message.mentions?.users?.first() || message.author;
      const iq = rand(1, 200);
      return sendEmbed({
        color: 0x3498db,
        description: `🧠 **${target.username}**'s IQ: **${iq}**`,
      });
    }

    case "howgay": {
      const target = message.mentions?.users?.first() || message.author;
      const pct = rand(0, 100);
      return sendEmbed({
        color: 0xe91e63,
        description: `🏳️‍🌈 **${target.username}** is **${pct}%** gay`,
      });
    }

    default:
      return;
  }
}
