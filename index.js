
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
  throw new Error("Missing DISCORD_TOKEN or CLIENT_ID.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's connection."),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("View Limbus bot commands.")
].map(command => command.toJSON());

async function start() {
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands }
  );

  await client.login(token);
}

client.once("clientReady", ready => {
  console.log(`Connected as ${ready.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply({
      content: `Pong! ${client.ws.ping} ms`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor(0x8B5CF6)
      .setTitle("Limbus Company | Command Guide")
      .setDescription("Welcome, Manager.")
      .addFields({
        name: "Utility",
        value: "`/ping` — Check connection\n`/help` — Show this guide"
      })
      .setFooter({ text: "Limbus Company • Initial Release" });

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
});

start().catch(error => {
  console.error("Startup failed:", error);
  process.exit(1);
});
