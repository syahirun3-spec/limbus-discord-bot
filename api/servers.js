"use strict";

const { cors, options, json, verifySession, isManager, discordApi, BOT_TOKEN } = require("../lib/auth");

module.exports = async function handler(req, res) {
  if (options(req, res)) return;
  cors(req, res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const session = verifySession(req);
  if (!session) return json(res, 401, { error: "Your Discord session expired. Sign in again." });
  if (!BOT_TOKEN) return json(res, 503, { error: "The bot token is not configured on the backend." });

  const candidates = (session.guilds || []).filter(g => isManager(g, session.sub)).slice(0, 40);
  const checks = await Promise.all(candidates.map(async guild => {
    try {
      await discordApi("/guilds/" + encodeURIComponent(guild.id));
      return { id: guild.id, name: guild.name, icon: guild.icon, owner: !!guild.owner };
    } catch (error) {
      if (error.status === 403 || error.status === 404) return null;
      return null;
    }
  }));
  return json(res, 200, { servers: checks.filter(Boolean), checked: candidates.length });
};
