"use strict";

const $ = selector => document.querySelector(selector);
const number = value => Number(value || 0).toLocaleString("en-US");
let currentGuild = "";

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed (" + response.status + ")");
  return data;
}
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
async function refreshHealth() {
  try {
    const health = await api("/api/health");
    setText("live-status", health.dashboard === "online" ? "WEB SERVICE ONLINE" : "WEB SERVICE OFFLINE");
    const pill = $("#live-status");
    if (pill) pill.className = "pill " + (health.dashboard === "online" ? "" : "muted");
    setText("sidebar-status", health.dashboard === "online" ? "Web service online" : "Web service offline");
    setText("web-health", health.dashboard === "online" ? "ONLINE" : "OFFLINE");
    setText("discord-health", health.discordApi === "connected" ? "API REACHABLE" : health.discordApi === "not-configured" ? "NOT CONFIGURED" : "UNREACHABLE");
    setText("checked-at", new Date(health.checkedAt).toLocaleTimeString());
  } catch {
    setText("live-status", "STATUS UNAVAILABLE");
    setText("sidebar-status", "Status unavailable");
  }
}
function renderLeaderboard(rows) {
  const root = $("#leaderboard");
  if (!root) return;
  if (!rows.length) {
    root.innerHTML = '<div class="empty-state">No recorded balances for this server yet.</div>';
    return;
  }
  root.replaceChildren();
  rows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "leader-row";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const member = document.createElement("span");
    member.className = "member-id";
    member.textContent = "Member ID · " + row.id;
    const total = document.createElement("span");
    total.className = "member-total";
    total.textContent = number(row.total) + " Lunacy";
    const detail = document.createElement("small");
    detail.textContent = number(row.cash) + " cash · " + number(row.bank) + " bank";
    total.append(detail);
    item.append(rank, member, total);
    root.append(item);
  });
}
async function loadGuildData() {
  if (!currentGuild) return;
  try {
    const data = await api("/api/dashboard?guildId=" + encodeURIComponent(currentGuild));
    setText("stat-accounts", number(data.memberAccounts));
    setText("stat-cash", number(data.totals.cash));
    setText("stat-bank", number(data.totals.bank));
    setText("stat-net", number(data.netWorth));
    renderLeaderboard(data.leaderboard);
  } catch (error) {
    renderLeaderboard([]);
    const root = $("#leaderboard");
    if (root) {
      const msg = document.createElement("div");
      msg.className = "empty-state";
      msg.textContent = error.message;
      root.replaceChildren(msg);
    }
  }
}
async function initAuth() {
  const loginNotice = $("#login-notice");
  const content = $("#dashboard-content");
  try {
    const data = await api("/api/me");
    if (loginNotice) loginNotice.classList.add("hidden");
    if (content) content.classList.remove("hidden");
    const chip = $("#user-chip");
    if (chip) {
      chip.textContent = data.user.global_name || data.user.username;
      chip.classList.remove("hidden");
    }
    const loginButton = $("#login-button");
    if (loginButton) {
      loginButton.textContent = "Sign out";
      loginButton.addEventListener("click", async () => {
        await api("/api/logout", { method: "POST" }).catch(() => {});
        location.reload();
      });
    }
    const select = $("#guild-select");
    if (select) {
      select.replaceChildren();
      if (!data.guilds.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No manageable servers";
        select.append(option);
      }
      data.guilds.forEach(guild => {
        const option = document.createElement("option");
        option.value = guild.id;
        option.textContent = guild.name;
        select.append(option);
      });
      currentGuild = data.guilds[0]?.id || "";
      select.value = currentGuild;
      select.addEventListener("change", () => {
        currentGuild = select.value;
        loadGuildData();
      });
      loadGuildData();
    }
  } catch {
    if (loginNotice) loginNotice.classList.remove("hidden");
    if (content) content.classList.add("hidden");
    const loginButton = $("#login-button");
    if (loginButton) loginButton.addEventListener("click", () => location.href = "/auth/discord");
  }
}
refreshHealth();
initAuth();
setInterval(refreshHealth, 30000);
