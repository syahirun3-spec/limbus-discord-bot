"use strict";

const { spawn } = require("node:child_process");

const children = [
  spawn(process.execPath, ["index.js"], { stdio: "inherit", env: process.env }),
  spawn(process.execPath, ["dashboard.js"], { stdio: "inherit", env: process.env })
];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500).unref();
}
for (const child of children) {
  child.on("error", error => {
    console.error("Could not start service:", error);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error("A service exited (code:", code, "signal:", signal, "). Stopping the application.");
      shutdown(code || 1);
    }
  });
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
