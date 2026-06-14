# AOI — Discord Bot & Dashboard

Multi-purpose Discord bot with an Express API dashboard. 14 slash/context commands, 15+ passive features, 22 services, 7 REST API route groups, and a WebSocket overview endpoint.

## Features

### Slash Commands

| Command | Module | Description |
|---|---|---|
| `/user info` | User Info | User info panel (banner, avatar, roles, decoration, timestamps) |
| `/waifu` | Fun | Interactive waifu drop — Smash (claim) or Pass |
| `/husbando` | Fun | Same as `/waifu` but for husbandos |
| `/profile` | Community | Interactive bot profile style config (font, effect, colors) — admin only |
| `/randomizedrolecolor` | Community | Toggle automatic role color rotation |
| `/memes` | Community | Meme autopost status & controls |
| `/domain-expansion` | Community | Apply accused role with optional message purge |
| `/free` | Community | Remove accused role from a user |
| `/case` | Moderation | Message context menu — Warn / Timeout / Kick |
| `/ticket` | Tickets | Thread-based ticket panel & user management |
| `/channel` | Tools | Broadcast a message to every channel |

### Passive Features

- DM welcomer, leave messages, boost announcements
- UWU lock enforcement
- Premium keyword-triggered responses
- Meme autopost from Reddit subreddits
- Role color rotation
- Bot presence/activity management
- Ghost ping detection
- AFK auto-clear & LOA tracking
- Autoresponder with placeholder templates
- Staff list auto-update
- Rate limiting & config cache auto-refresh

### Infrastructure

- **Supabase** (PostgreSQL) — all persistent storage
- **Redis** — caching, rate limiting, queues, session store
- **Express** — REST API + WebSocket dashboard
- **discord.js v14** — Discord gateway & API

## Getting Started

See [QUICK_START.md](./QUICK_START.md) for setup instructions.
