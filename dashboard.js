"use strict";

const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DASHBOARD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DASHBOARD_REDIRECT_URI;
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;
const ADMIN_IDS = new Set((process.env.DASHBOARD_ADMIN_IDS || "").split(",").map(x => x.trim()).filter(Boolean));
const DATA_FILE = path.join(__dirname, "data", "economy.json");
const sessions = new Map();
const states = new Map();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}
function cookieValue(req, name) {
  const item = (req.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}
function setCookie(res, name, value, options = {}) {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=" + (options.maxAge ?? 86400)];
  if (process.env.NODE_ENV === "production") flags.push("Secure");
  res.setHeader("Set-Cookie", name + "=" + encodeURIComponent(value) + "; " + flags.join("; "));
}
function clearCookie(res, name) {
  res.setHeader("Set-Cookie", name + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}
function sessionFor(req) {
  const raw = cookieValue(req, "limbus_session");
  if (!SESSION_SECRET || !raw || !raw.includes(".")) return null;
  const [id, signature] = raw.split(".");
  const expected = id ? sign(id) : "";\n  if (!id || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const session = sessions.get(id);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}
function requireSession(req, res, next) {
  const session = sessionFor(req);
  if (!session) return res.status(401).json({ error: "Sign in with Discord to continue." });
  req.session = session;
  next();
}
async function discordRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error("Discord API returned HTTP " + response.status);
  return response.status === 204 ? null : response.json();
}
function readDatabase() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { servers: {} };
  }
}
function canManageGuild(session, guildId) {
  const guild = session.guilds.find(g => g.id === guildId);
  if (!guild) return false;
  const permissions = BigInt(guild.permissions || "0");
  const MANAGE_GUILD = 1n << 5n;
  const ADMINISTRATOR = 1n << 3n;
  return ADMIN_IDS.has(session.user.id) || (permissions & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n || guild.owner === true;
}
function safeGuild(guild) {
  return { id: guild.id, name: guild.name, icon: guild.icon, owner: guild.owner === true };
}

app.get("/auth/discord", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !SESSION_SECRET) {
    return res.status(503).send("Dashboard OAuth is not configured. Add the required environment variables in your hosting provider.");
  }
  const state = crypto.randomBytes(24).toString("hex");
  states.set(state, Date.now() + 10 * 60 * 1000);
  setCookie(res, "limbus_oauth_state", state, { maxAge: 600 });
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
    state
  });
  res.redirect("https://discord.com/oauth2/authorize?" + params.toString());
});

app.get("/auth/callback", async (req, res) => {
  const state = String(req.query.state || "");
  const savedState = cookieValue(req, "limbus_oauth_state");
  clearCookie(res, "limbus_oauth_state");
  const expiry = states.get(state);
  states.delete(state);
  if (!state || state !== savedState || !expiry || expiry < Date.now()) {
    return res.status(400).send("Login state expired or did not match. Return to the dashboard and try again.");
  }
  if (!req.query.code) return res.status(400).send("Discord did not return an authorization code.");
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(req.query.code),
        redirect_uri: REDIRECT_URI
      })
    });
    if (!tokenResponse.ok) throw new Error("OAuth token exchange failed with HTTP " + tokenResponse.status);
    const token = await tokenResponse.json();
    const headers = { Authorization: "Bearer " + token.access_token };
    const [user, guilds] = await Promise.all([
      discordRequest("https://discord.com/api/users/@me", { headers }),
      discordRequest("https://discord.com/api/users/@me/guilds", { headers })
    ]);
    const id = crypto.randomBytes(32).toString("hex");
    sessions.set(id, {
      user: { id: user.id, username: user.username, global_name: user.global_name || user.username, avatar: user.avatar },
      guilds: guilds.filter(g => {
        const p = BigInt(g.permissions || "0");
        return ADMIN_IDS.has(user.id) || g.owner || (p & ((1n << 5n) | (1n << 3n))) !== 0n;
      }),
      expiresAt: Date.now() + Math.min(Number(token.expires_in || 604800), 604800) * 1000
    });
    setCookie(res, "limbus_session", id + "." + sign(id), { maxAge: 604800 });
    res.redirect("/");
  } catch (error) {
    console.error("Discord dashboard login failed:", error.message);
    res.status(502).send("Discord login failed. Check the OAuth application settings and redirect URL, then try again.");
  }
});

app.get("/api/me", requireSession, (req, res) => {
  res.json({ user: req.session.user, guilds: req.session.guilds.map(safeGuild) });
});

app.get("/api/health", async (req, res) => {
  let discordApi = "not-configured";
  if (TOKEN) {
    try {
      await discordRequest("https://discord.com/api/v10/users/@me", { headers: { Authorization: "Bot " + TOKEN } });
      discordApi = "connected";
    } catch {
      discordApi = "unreachable";
    }
  }
  res.json({ dashboard: "online", discordApi, checkedAt: new Date().toISOString() });
});

app.get("/api/dashboard", requireSession, (req, res) => {
  const guildId = String(req.query.guildId || "");
  if (!guildId || !canManageGuild(req.session, guildId)) return res.status(403).json({ error: "Choose a server you manage." });
  const database = readDatabase();
  const accounts = Object.entries((database.servers || {})[guildId] || {});
  const totals = accounts.reduce((sum, [, a]) => {
    sum.cash += Number.isSafeInteger(a.cash) && a.cash > 0 ? a.cash : 0;
    sum.bank += Number.isSafeInteger(a.bank) && a.bank > 0 ? a.bank : 0;
    return sum;
  }, { cash: 0, bank: 0 });
  const leaderboard = accounts.map(([id, a]) => ({
    id, cash: Math.max(0, Number(a.cash) || 0), bank: Math.max(0, Number(a.bank) || 0)
  })).map(a => ({ ...a, total: a.cash + a.bank }))
    .sort((a, b) => b.total - a.total).slice(0, 10);
  res.json({
    guildId,
    memberAccounts: accounts.length,
    totals,
    netWorth: totals.cash + totals.bank,
    leaderboard
  });
});

app.post("/api/logout", requireSession, (req, res) => {
  const raw = cookieValue(req, "limbus_session");
  if (raw) sessions.delete(raw.split(".")[0]);
  clearCookie(res, "limbus_session");
  res.json({ ok: true });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/economy", (req, res) => res.sendFile(path.join(__dirname, "public", "economy.html")));
app.get("/moderation", (req, res) => res.sendFile(path.join(__dirname, "public", "moderation.html")));
app.get("/settings", (req, res) => res.sendFile(path.join(__dirname, "public", "settings.html")));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("Limbus dashboard listening on port " + PORT);
});
function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
