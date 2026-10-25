"use strict";

const crypto = require("node:crypto");
const { CLIENT_ID, REDIRECT_URI, requireConfig } = require("../../lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed.");
  const missing = requireConfig();
  if (missing.length) return res.status(503).send("Discord OAuth is not configured. Missing: " + missing.join(", "));
  const state = crypto.randomBytes(32).toString("hex");
  res.setHeader("Set-Cookie", "limbus_oauth_state=" + state + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
    state
  });
  res.redirect(302, "https://discord.com/oauth2/authorize?" + params.toString());
};
