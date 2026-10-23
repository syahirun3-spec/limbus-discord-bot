
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const COLOR = 0x8B5CF6;
const CURRENCY = "🌙 Lunacy";

const DAILY_MIN = 500;
const DAILY_MAX = 1500;
const WEEKLY_MIN = 2500;
const WEEKLY_MAX = 6000;

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

if (!TOKEN || !CLIENT_ID) {
  throw new Error(
    "Missing DISCORD_TOKEN or CLIENT_ID environment variables."
  );
}

// Persistent JSON database.
// The hosting provider must preserve this file to preserve balances.
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "economy.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDatabase() {
  if (!fs.existsSync(DATA_FILE)) {
    return { servers: {} };
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Could not read economy database:", error);
    throw new Error(
      "The economy database is invalid. Back it up before repairing it."
    );
  }
}

const database = loadDatabase();

function saveDatabase() {
  const temporaryFile = DATA_FILE + ".tmp";

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(database, null, 2),
    "utf8"
  );

  fs.renameSync(temporaryFile, DATA_FILE);
}

function getAccount(guildId, userId) {
  if (!database.servers[guildId]) {
    database.servers[guildId] = {};
  }

  const server = database.servers[guildId];

  if (!server[userId]) {
    server[userId] = {
      cash: 0,
      bank: 0,
      cooldowns: {}
    };
  }

  const account = server[userId];

  account.cash = Number.isSafeInteger(account.cash)
    ? Math.max(0, account.cash)
    : 0;

  account.bank = Number.isSafeInteger(account.bank)
    ? Math.max(0, account.bank)
    : 0;

  if (!account.cooldowns || typeof account.cooldowns !== "object") {
    account.cooldowns = {};
  }

  return account;
}

function randomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatNumber(number) {
  return number.toLocaleString("en-US");
}

function createEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Limbus Company • Lunacy Division" })
    .setTimestamp();
}

function cooldownMessage(nextClaim) {
  const unix = Math.ceil(nextClaim / 1000);
  return `You have already claimed this reward. Try again <t:${unix}:R>.`;
}

const commands = [
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("View your Lunacy balance.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("View another member's balance.")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("bank")
    .setDescription("Manage your Lunacy savings.")
    .addSubcommand(subcommand =>
      subcommand
        .setName("deposit")
        .setDescription("Deposit cash into your bank.")
        .addIntegerOption(option =>
          option
            .setName("amount")
            .setDescription("Amount of Lunacy to deposit.")
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("withdraw")
        .setDescription("Withdraw Lunacy from your bank.")
        .addIntegerOption(option =>
          option
            .setName("amount")
            .setDescription("Amount of Lunacy to withdraw.")
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily Lunacy allowance."),

  new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("Claim your weekly Lunacy allowance."),

  new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Send Lunacy to another member.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The member receiving your Lunacy.")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount of Lunacy to send.")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("richest")
    .setDescription("View the richest members in this server."),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("View the Lunacy economy command guide.")
].map(command => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", readyClient => {
  console.log(`Connected as ${readyClient.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.inGuild()) {
    return interaction.reply({
      content: "Use the Lunacy economy commands inside a server.",
      ephemeral: true
    });
  }

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const command = interaction.commandName;

  try {
    if (command === "balance") {
      const target = interaction.options.getUser("user") || interaction.user;
      const account = getAccount(guildId, target.id);

      saveDatabase();

      const embed = createEmbed(
        "🌙 Lunacy Account",
        `Account holder: ${target}`
      ).addFields(
        {
          name: "💵 Cash",
          value: `${CURRENCY}\n**${formatNumber(account.cash)}**`,
          inline: true
        },
        {
          name: "🏦 Bank",
          value: `${CURRENCY}\n**${formatNumber(account.bank)}**`,
          inline: true
        },
        {
          name: "💠 Net Worth",
          value: `${CURRENCY}\n**${formatNumber(account.cash + account.bank)}**`,
          inline: false
        }
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (command === "bank") {
      const action = interaction.options.getSubcommand();
      const amount = interaction.options.getInteger("amount");
      const account = getAccount(guildId, userId);

      if (action === "deposit") {
        if (account.cash < amount) {
          return interaction.reply({
            content: `You only have ${formatNumber(account.cash)} Lunacy in cash.`,
            ephemeral: true
          });
        }

        account.cash -= amount;
        account.bank += amount;
      } else {
        if (account.bank < amount) {
          return interaction.reply({
            content: `You only have ${formatNumber(account.bank)} Lunacy in your bank.`,
            ephemeral: true
          });
        }

        account.bank -= amount;
        account.cash += amount;
      }

      saveDatabase();

      const embed = createEmbed(
        action === "deposit" ? "🏦 Deposit Complete" : "🏦 Withdrawal Complete",
        `Moved **${formatNumber(amount)} ${CURRENCY}** ${action === "deposit" ? "into" : "out of"} your bank.`
      ).addFields(
        {
          name: "Cash",
          value: formatNumber(account.cash),
          inline: true
        },
        {
          name: "Bank",
          value: formatNumber(account.bank),
          inline: true
        }
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (command === "daily" || command === "weekly") {
      const account = getAccount(guildId, userId);
      const now = Date.now();
      const duration = command === "daily" ? DAY : WEEK;
      const nextClaim = (account.cooldowns[command] || 0) + duration;

      if (account.cooldowns[command] && now < nextClaim) {
        return interaction.reply({
          content: cooldownMessage(nextClaim),
          ephemeral: true
        });
      }

      const reward = command === "daily"
        ? randomAmount(DAILY_MIN, DAILY_MAX)
        : randomAmount(WEEKLY_MIN, WEEKLY_MAX);

      account.cash += reward;
      account.cooldowns[command] = now;

      saveDatabase();

      const embed = createEmbed(
        command === "daily" ? "📅 Daily Allowance" : "🗓️ Weekly Allowance",
        `You received **${formatNumber(reward)} ${CURRENCY}**.`
      ).addFields({
        name: "Current Cash",
        value: `${formatNumber(account.cash)} ${CURRENCY}`
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (command === "pay") {
      const target = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");

      if (target.id === userId) {
        return interaction.reply({
          content: "You cannot send Lunacy to yourself.",
          ephemeral: true
        });
      }

      if (target.bot) {
        return interaction.reply({
          content: "You cannot send Lunacy to a bot.",
          ephemeral: true
        });
      }

      const sender = getAccount(guildId, userId);

      if (sender.cash < amount) {
        return interaction.reply({
          content: `Insufficient cash. Your current cash is ${formatNumber(sender.cash)} Lunacy.`,
          ephemeral: true
        });
      }

      const recipient = getAccount(guildId, target.id);

      if (recipient.cash + amount > Number.MAX_SAFE_INTEGER) {
        return interaction.reply({
          content: "That transfer is too large.",
          ephemeral: true
        });
      }

      sender.cash -= amount;
      recipient.cash += amount;

      saveDatabase();

      const embed = createEmbed(
        "💸 Lunacy Transfer",
        `Transferred **${formatNumber(amount)} ${CURRENCY}** to ${target}.`
      ).addFields({
        name: "Remaining Cash",
        value: `${formatNumber(sender.cash)} ${CURRENCY}`
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (command === "richest") {
      await interaction.deferReply();

      const server = database.servers[guildId] || {};

      const ranking = Object.entries(server)
        .map(([id, account]) => ({
          id,
          total: (account.cash || 0) + (account.bank || 0)
        }))
        .filter(entry => entry.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      if (ranking.length === 0) {
        return interaction.editReply({
          embeds: [
            createEmbed(
              "🏆 Richest Members",
              "No one has earned Lunacy yet. Claim `/daily` to get started."
            )
          ]
        });
      }

      const lines = [];

      for (let index = 0; index < ranking.length; index++) {
        const entry = ranking[index];
        const user = await client.users.fetch(entry.id).catch(() => null);
        const name = user ? user.username : "Unknown member";

        lines.push(
          `**${index + 1}.** ${name} — **${formatNumber(entry.total)}** ${CURRENCY}`
        );
      }

      const embed = createEmbed(
        "🏆 Server Rich List",
        lines.join("\n")
      );

      return interaction.editReply({ embeds: [embed] });
    }

    if (command === "help") {
      const embed = createEmbed(
        "📖 Lunacy Economy",
        "Earn, save and transfer Lunacy in this server."
      ).addFields(
        {
          name: "Account",
          value: "`/balance [user]` — View cash, bank and net worth\n`/richest` — Server leaderboard"
        },
        {
          name: "Banking",
          value: "`/bank deposit amount` — Deposit cash\n`/bank withdraw amount` — Withdraw savings"
        },
        {
          name: "Earn and Transfer",
          value: "`/daily` — Claim 500–1,500 Lunacy every 24 hours\n`/weekly` — Claim 2,500–6,000 Lunacy every 7 days\n`/pay user amount` — Transfer cash"
        }
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error(`Command ${command} failed:`, error);

    const message = {
      content: "Something went wrong while processing that command. Please try again.",
      ephemeral: true
    };

    if (interaction.deferred) {
      return interaction.editReply({ content: message.content });
    }

    if (interaction.replied) {
      return interaction.followUp(message);
    }

    return interaction.reply(message);
  }
});

async function start() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  console.log("Registering Lunacy economy commands...");

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("Commands registered.");

  await client.login(TOKEN);
}

start().catch(error => {
  console.error("Startup failed:", error);
  process.exit(1);
});
