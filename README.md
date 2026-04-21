# Discord Bot System

This repo has two active applications:

- `backend/`: Discord runtime plus Express API
- `landing/`: public site and thin dashboard frontend

Authentication now lives in the backend. There is no separate `dashboard/` app anymore.

## Current Scope

- single Discord runtime in `backend/src/index.js`
- backend-owned Discord OAuth session flow
- landing app that proxies auth and dashboard requests to the backend
- Supabase used only as the backend data store
- lightweight feature set first; heavy systems like tickets and XP are intentionally out of scope

## Repo Layout

```text
/
|-- backend/
|-- landing/
|-- supabase/
|-- README.md
|-- QUICK_START.md
|-- TESTING.md
`-- DEPLOYMENT.md
```

## What Exists Today

- Moderation core: warn, timeout, kick, ban, unban, cases, AFK, LOA
- Community core: welcome, leave, boost, UwU lock, staff rating, staff leaderboard
- Lightweight tools and meme modules
- Guild overview, settings, module listing, analytics snapshots, and Discord-based dashboard auth

## Local Development

Backend:

```bash
cd backend
npm install
npm run dev
```

Landing:

```bash
cd landing
npm install
npm run dev
```

## Required Environment Variables

Backend:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_OAUTH_CLIENT_ID`
- `DISCORD_OAUTH_CLIENT_SECRET`
- `DISCORD_OAUTH_REDIRECT_URI`
- `SESSION_SECRET`
- `GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Landing:

- `BACKEND_API_URL`
- `FRONTEND_APP_URL`
- `DISCORD_REDIRECT_URI`
- `NEXT_PUBLIC_DASHBOARD_URL` optional

## Notes

- Slash interactions are deferred by default, so handlers should reply with `editReply()`.
- The frontend should stay thin. Auth, guild access checks, and data writes belong in the backend.
- If you add new dashboard surfaces, wire the backend route first and keep the page aligned with the actual module set.
