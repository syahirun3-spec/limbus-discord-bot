"use strict";

const { cors, options, json, discordApi, BOT_TOKEN } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (options(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  let botApi = "not-configured";
  let botName = null;
  if (BOT_TOKEN) {
    try {
      const bot = await discordApi("/users/@me");
      botApi = "connected";
      botName = bot.username || null;
    } catch {
      botApi = "unreachable";
    }
  }
  cors(req, res);
  return json(res, 200, {
    backend: "online",
    discordApi: botApi,
    botName,
    checkedAt: new Date().toISOString(),
    note: "Discord REST reachability does not prove the bot Gateway process is online."
  });
};
