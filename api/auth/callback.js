"use strict";

const crypto = require("node:crypto");
const {
  CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, FRONTEND_URL,
  createSession, requireConfig
} = require("../../lib/auth");

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";").map(x => x.trim());
  const item = cookies.find(x => x.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed.");
  const missing = requireConfig();
  if (missing.length) return res.status(503).send("Discord OAuth is not configured. Missing: " + missing.join(", "));
  const state = String(req.query.state || "");
  const savedState = readCookie(req, "limbus_oauth_state");
  res.setHeader("Set-Cookie", "limbus_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  if (!state || !savedState || state.length !== savedState.length ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(savedState))) {
    return res.status(400).send("Discord login state was invalid or expired. Return to the dashboard and try again.");
  }
  if (req.query.error) return res.status(400).send("Discord authorization was cancelled.");
  const code = String(req.query.code || "");
  if (!code) return res.status(400).send("Discord did not return an authorization code.");

  try {
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    if (!tokenResponse.ok) throw new Error("Discord token exchange failed.");
    const oauth = await tokenResponse.json();
    const headers = { Authorization: "Bearer " + oauth.access_token };
    const [userResponse, guildResponse] = await Promise.all([
      fetch("https://discord.com/api/v10/users/@me", { headers }),
      fetch("https://discord.com/api/v10/users/@me/guilds", { headers })
    ]);
    if (!userResponse.ok || !guildResponse.ok) throw new Error("Discord profile lookup failed.");
    const [user, guilds] = await Promise.all([userResponse.json(), guildResponse.json()]);
    const session = createSession(user, guilds);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.redirect(302, FRONTEND_URL + "#session=" + encodeURIComponent(session));
  } catch (error) {
    console.error("Discord OAuth callback failed:", error.message);
    res.status(502).send("Discord login failed. Verify the OAuth redirect URI and application credentials.");
  }
};
