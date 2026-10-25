"use strict";

const { cors, options, json, verifySession } = require("../lib/auth");

module.exports = function handler(req, res) {
  if (options(req, res)) return;
  cors(req, res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const session = verifySession(req);
  if (!session) return json(res, 401, { error: "Your Discord session expired. Sign in again." });
  return json(res, 200, {
    user: session.user,
    expiresAt: session.exp * 1000
  });
};
