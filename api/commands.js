"use strict";

const { cors, options, json, verifySession } = require("../lib/auth");

const COMMANDS = [
  { name: "balance", description: "View your Lunacy balance.", usage: "/balance [user]", category: "Account" },
  { name: "bank", description: "Deposit or withdraw Lunacy.", usage: "/bank deposit amount · /bank withdraw amount", category: "Economy" },
  { name: "daily", description: "Claim your daily Lunacy allowance.", usage: "/daily", category: "Economy" },
  { name: "weekly", description: "Claim your weekly Lunacy allowance.", usage: "/weekly", category: "Economy" },
  { name: "pay", description: "Send Lunacy to another member.", usage: "/pay user amount", category: "Economy" },
  { name: "richest", description: "View the richest members in this server.", usage: "/richest", category: "Leaderboard" },
  { name: "help", description: "View the Lunacy economy command guide.", usage: "/help", category: "Help" }
];

module.exports = function handler(req, res) {
  if (options(req, res)) return;
  cors(req, res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  if (!verifySession(req)) return json(res, 401, { error: "Your Discord session expired. Sign in again." });
  return json(res, 200, { commands: COMMANDS });
};
