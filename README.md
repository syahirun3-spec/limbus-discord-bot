# Limbus Company Discord Bot + Dashboard

A Node.js 22 / discord.js 14 Lunacy economy bot with a responsive multi-page web dashboard.

## Pages

- `/` — system overview and service health
- `/economy` — server-scoped Lunacy totals and richest accounts
- `/moderation` — clearly marked planned moderation module
- `/settings` — deployment configuration guide

## Run locally

1. Install Node.js 22.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the Discord bot token and application ID.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The bot and dashboard are started together. Never commit `.env`.

## Discord OAuth setup

In the Discord Developer Portal, add an OAuth2 redirect URI that exactly matches your public dashboard URL plus `/auth/callback`. Configure these hosting environment variables:

- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — Discord application ID
- `DASHBOARD_CLIENT_SECRET` — OAuth2 client secret
- `DASHBOARD_REDIRECT_URI` — exact callback URL, e.g. `https://YOUR-DOMAIN/auth/callback`
- `DASHBOARD_SESSION_SECRET` — long random secret
- `DASHBOARD_ADMIN_IDS` — optional comma-separated Discord user IDs
- `PORT` — supplied by most hosting providers

OAuth asks for `identify guilds`; users see servers where they have Manage Server or Administrator permissions, unless listed in `DASHBOARD_ADMIN_IDS`.

## Deployment

Deploy as a persistent Node.js web service with a public HTTPS URL. Set the start command to `npm start`, Node version to 22, and configure the environment variables in the host dashboard. Configure the Discord OAuth redirect URI to match the deployed URL.

GitHub stores source code; it does not keep the bot running by itself. GitHub Actions only performs checks. Connect a hosting provider to make the service live.

## Data persistence

The existing economy uses `data/economy.json`, which is excluded from Git. Use a persistent disk or migrate to a database before relying on balances in production. Multiple instances must not write to this JSON file concurrently.

## Current limitations

- The moderation page is a placeholder; moderation records and commands are not implemented in the current bot.
- Dashboard status checks the web server and Discord API token reachability. Token reachability alone does not prove that the bot's Gateway connection is active.
- The dashboard displays member IDs rather than resolving display names.
- No hosting provider was connected and no deployment was performed by these source changes.
