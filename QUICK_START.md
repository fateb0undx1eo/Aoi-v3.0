# Quick Start

## Prerequisites

- Node.js 18+
- A Discord Application (https://discord.com/developers/applications)
- A Supabase project (https://supabase.com)
- A Redis instance (Upstash, Render Redis, or local)

## 1. Clone & Install

```bash
git clone <repo>
cd aoi-v3/backend
npm install
```

## 2. Environment Variables

Copy the template and fill in your values:

```env
# Required
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis
REDIS_URL=redis://default:password@host:6379

# OAuth for Dashboard
DISCORD_OAUTH_CLIENT_ID=your_client_id
DISCORD_OAUTH_CLIENT_SECRET=your_client_secret
FRONTEND_URL=https://your-frontend.com
CORS_ALLOWED_ORIGINS=https://your-frontend.com

# Guild (omit for global commands)
GUILD_ID=your_guild_id

# Optional: Reddit for meme autopost
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=...

# Optional: role IDs for domain-expansion
DOMAIN_EXPANSION=role_id
ACCUSED_ROLE=role_id
```

## 3. Supabase Setup

Your Supabase schema must include these tables:
- `module_configs` — guild module configurations
- `rate_limit_rules` — per-guild rate limit rules
- Moderation tables: `cases`, `afk_status`, `loa_status`, `ghost_pings`
- Tools tables: `auto_responses`
- Analytics tables: `analytics_events`
- Tickets tables: `ticket_configs`, `ticket_audit_logs`, `ticket_cooldowns`

## 4. Run

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

## 5. Bot Intents (Discord Developer Portal)

Enable these Privileged Gateway Intents:
- `SERVER MEMBERS INTENT`
- `MESSAGE CONTENT INTENT`
- `GUILD PRESENCES INTENT` (for profile style features)
