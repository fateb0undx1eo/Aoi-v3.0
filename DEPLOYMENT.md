# Deployment Guide

## Recommended Shape

- deploy `backend/` as one Node service
- deploy `landing/` as one Next.js frontend
- keep Supabase as the shared database

This matches the current architecture: the backend owns Discord auth, sessions, API routes, and the Discord client itself.

## Backend Deployment

Deploy `backend/` to a Node host such as Render, Railway, or Fly.

Build/start:

```bash
cd backend
npm install
npm start
```

Required backend env:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_OAUTH_CLIENT_ID`
- `DISCORD_OAUTH_CLIENT_SECRET`
- `DISCORD_OAUTH_REDIRECT_URI`
- `SESSION_SECRET`
- `GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_PORT`

## Landing Deployment

Deploy `landing/` separately as the frontend. This repo now includes a root `render.yaml` that defines the frontend as its own Render web service, separate from the backend.

Build/start:

```bash
cd landing
npm install
npm run build
npm start
```

Render service shape:

- runtime: `Node`
- root directory: `landing`
- build command: `npm install && npm run build`
- start command: `npm start`
- `PORT` is provided by Render automatically

Required landing env:

- `BACKEND_API_URL`
- `FRONTEND_APP_URL`
- `DISCORD_REDIRECT_URI`
- `NEXT_PUBLIC_DASHBOARD_URL` optional

## Discord OAuth Setup

Register the landing callback URL in the Discord application:

- local example: `http://localhost:3002/api/auth/callback`
- production example: `https://your-domain.com/api/auth/callback`

The landing app forwards the OAuth exchange to the backend, and the backend issues the session cookie.

## Post-Deploy Checks

1. Verify backend `/healthz`
2. Verify Discord login from `/dashboard`
3. Verify server picker loads
4. Verify one moderation command and one community command
5. Verify analytics snapshots still write for the configured guild
