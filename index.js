const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's response time."),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("View the bot's available commands.")
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands }
  );

  console.log("Slash commands registered.");
}

client.once("clientReady", readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply({
      content: `Pong! Gateway latency: ${client.ws.ping} ms`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor(0x8B5CF6)
      .setTitle("Limbus Company | Command Guide")
      .setDescription("Welcome, Manager. Your journey begins here.")
      .addFields(
        {
          name: "Utility",
          value: "`/ping` — Check bot latency."
        },
        {
          name: "Information",
          value: "`/help` — View this command guide."
        }
      )
      .setFooter({
        text: "Limbus Company • Initial Release"
      });

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
});

async function main() {
  try {
    await registerCommands();
    await client.login(token);
  } catch (error) {
    console.error("Bot startup failed:", error);
    process.exit(1);
  }
}

main();
