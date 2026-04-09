# Quick Start

## 1. Configure the Backend

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and set:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_OAUTH_CLIENT_ID`
- `DISCORD_OAUTH_CLIENT_SECRET`
- `DISCORD_OAUTH_REDIRECT_URI`
- `SESSION_SECRET`
- `GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then start it:

```bash
npm run dev
```

## 2. Configure the Landing App

```bash
cd landing
npm install
```

Copy `landing/.env.example` to `landing/.env` and set:

- `BACKEND_API_URL=http://localhost:3001`
- `DISCORD_REDIRECT_URI=http://localhost:3002/api/auth/callback`

Then start it:

```bash
npm run dev
```

## 3. Open the Dashboard

- landing app: `http://localhost:3002`
- dashboard entry: `http://localhost:3002/dashboard`

The landing app sends Discord auth through the backend, and the backend owns the session cookie.

## 4. What to Verify

- backend boots and logs the Discord client in
- slash commands sync for your configured guild
- `http://localhost:3001/healthz` returns `{ ok: true }`
- logging in through `http://localhost:3002/dashboard` redirects back into the dashboard

## Current Scope

The repo is being kept intentionally light:

- keep: moderation core, community core, settings, lightweight tools
- skip: tickets, XP/leveling, heavy background systems
