"use strict";

const { cors, options, json, verifySession } = require("../lib/auth");

module.exports = function handler(req, res) {
  if (options(req, res)) return;
  cors(req, res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  if (!verifySession(req)) return json(res, 401, { error: "Your session has already expired." });
  return json(res, 200, { ok: true });
};
