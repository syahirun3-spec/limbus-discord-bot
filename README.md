# Limbus Company Discord Bot + Dashboard

Node.js 22 / discord.js 14 bot with a GitHub Pages frontend and a separate Vercel serverless API.

## Existing website

https://syahirun3-spec.github.io/limbus-discord-bot/

GitHub Pages continues to serve the static frontend. It does not run the bot process or store secrets.

## Dashboard features

- Discord OAuth2 sign-in using the authorization-code flow and a validated state value.
- Backend status and Discord REST API reachability.
- Server directory limited to servers the signed-in user can manage and where the bot is installed.
- Read-only command catalog for balance, bank, daily, weekly, pay, richest, and help.
- One-hour HMAC-signed dashboard sessions. The Discord OAuth access token is not sent to the browser.
- Responsive dark Limbus-style interface.

The dashboard does not execute moderation actions, edit slash commands, or prove that the bot Gateway connection is alive. Health checks only verify backend availability and Discord REST token reachability.

## Deploy the backend to Vercel

1. Sign in to Vercel and import the GitHub repository syahirun3-spec/limbus-discord-bot.
2. Keep the repository root as the project root. Vercel deploys files under api/ as serverless functions, separate from GitHub Pages.
3. In Vercel Project Settings → Environment Variables, add:
   - CLIENT_ID: Discord application ID.
   - DASHBOARD_CLIENT_SECRET: Discord OAuth2 client secret.
   - DASHBOARD_REDIRECT_URI: https://YOUR-VERCEL-PROJECT.vercel.app/api/auth/callback (replace the hostname).
   - DASHBOARD_SESSION_SECRET: random secret of at least 32 characters.
   - DISCORD_TOKEN: Discord bot token, kept server-side only.
   - FRONTEND_ORIGIN: https://syahirun3-spec.github.io
   - FRONTEND_URL: https://syahirun3-spec.github.io/limbus-discord-bot/
   - Optional DASHBOARD_ADMIN_IDS: comma-separated Discord user IDs for owner-level access.
4. In Discord Developer Portal → your application → OAuth2, add the exact redirect URI from step 3. Scopes are identify and guilds.
5. Deploy or redeploy after adding environment variables.
6. Open https://YOUR-VERCEL-PROJECT.vercel.app/api/health. Expect backend: online and discordApi: connected when the bot token is valid.
7. Edit index.html in this repository and replace https://YOUR-VERCEL-PROJECT.vercel.app in API_BASE with your real Vercel URL. Commit the change; GitHub Pages will publish the frontend update.
8. Open the GitHub Pages URL and test Sign in with Discord.

## Local validation

Install Node.js 22, then run:

    npm install
    npm run check

The Vercel API routes should be tested on Vercel or with the Vercel CLI. The existing persistent bot/dashboard server can still run locally with a private .env file and npm start.

## Security and limitations

- Never commit .env, the bot token, or the OAuth client secret.
- API_BASE is a public URL, not a secret.
- The short-lived signed dashboard token is stored in sessionStorage; it does not contain the bot token or OAuth access token.
- The callback validates the OAuth state cookie to reduce CSRF risk.
- CORS only allows the configured GitHub Pages origin.
- Server results are checked with the bot token before being returned.
- Rotating DASHBOARD_SESSION_SECRET invalidates existing sessions.
- The existing economy uses data/economy.json; Vercel serverless storage is not persistent. Keep the bot on a persistent host or migrate balances to a database before production use.

## Project layout

- index.html: GitHub Pages frontend.
- api/: Vercel API endpoints for OAuth, health, servers, and commands.
- lib/auth.js: shared OAuth/session helpers.
- index.js: Discord bot and slash commands.
- dashboard.js: existing persistent Express dashboard server.
