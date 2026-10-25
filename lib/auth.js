"use strict";

const crypto = require("node:crypto");

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://syahirun3-spec.github.io";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://syahirun3-spec.github.io/limbus-discord-bot/";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DASHBOARD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DASHBOARD_REDIRECT_URI;
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const ADMIN_IDS = new Set((process.env.DASHBOARD_ADMIN_IDS || "").split(",").map(x => x.trim()).filter(Boolean));

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin === FRONTEND_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function options(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

function sign(value) {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error("DASHBOARD_SESSION_SECRET must contain at least 32 characters.");
  }
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSession(user, guilds) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    user: {
      id: user.id,
      username: user.username,
      global_name: user.global_name || user.username,
      avatar: user.avatar || null
    },
    guilds: guilds.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon || null,
      owner: g.owner === true,
      permissions: String(g.permissions || "0")
    })),
    iat: now,
    exp: now + 3600
  })).toString("base64url");
  return payload + "." + sign(payload);
}

function verifySession(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  let expected;
  try { expected = sign(payload); } catch { return null; }
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.sub || !data.exp || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function requireConfig() {
  const missing = [];
  if (!CLIENT_ID) missing.push("CLIENT_ID");
  if (!CLIENT_SECRET) missing.push("DASHBOARD_CLIENT_SECRET");
  if (!REDIRECT_URI) missing.push("DASHBOARD_REDIRECT_URI");
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) missing.push("DASHBOARD_SESSION_SECRET (32+ characters)");
  return missing;
}

function isManager(guild, userId) {
  if (ADMIN_IDS.has(userId) || guild.owner) return true;
  try {
    const p = BigInt(guild.permissions || "0");
    return (p & ((1n << 5n) | (1n << 3n))) !== 0n;
  } catch {
    return false;
  }
}

async function discordApi(path, token = BOT_TOKEN) {
  if (!token) throw new Error("DISCORD_TOKEN is not configured on the backend.");
  const response = await fetch("https://discord.com/api/v10" + path, {
    headers: { Authorization: "Bot " + token }
  });
  if (!response.ok) {
    const error = new Error("Discord API returned HTTP " + response.status);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

module.exports = {
  FRONTEND_ORIGIN, FRONTEND_URL, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI,
  BOT_TOKEN, ADMIN_IDS, cors, options, json, createSession, verifySession,
  requireConfig, isManager, discordApi
};
