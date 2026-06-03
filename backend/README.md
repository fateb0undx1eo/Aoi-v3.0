# Backend — Discord Bot & API Server

## Project Structure

```
src/
├── main.js                    # Entry point
├── core/
│   ├── config/
│   │   └── env.js             # Environment variable loading
│   ├── loader/
│   │   └── bootstrap.js        # Module registry loader
│   ├── permissions/
│   │   └── permissionService.js
│   ├── rateLimiter/
│   │   └── dynamicRateLimiter.js
│   ├── configCache/
│   │   └── configCache.js      # Guild config cache with auto-refresh
│   ├── placeholderEngine/
│   │   └── placeholderEngine.js # Template rendering
│   ├── queue/
│   │   └── jobQueue.js          # DM broadcast job queue
│   └── redis.js                # Redis client singleton
├── modules/
│   ├── community/              # 6 commands + passive features
│   ├── fun/                    # /waifu, /husbando
│   ├── leveling/               # /rank with canvas card
│   ├── moderation/             # /case context menu
│   ├── tickets/                # Thread-based ticket system
│   ├── tools/                  # /channel broadcast + auto-responder
│   ├── settings/               # Dashboard config schema only
│   └── userinfo/               # /user info
├── services/                   # Backend service classes
├── interactions/
│   └── interactionRouter.js    # Slash command dispatch
├── api/
│   ├── server.js               # Express app setup
│   └── routes/                 # Route handlers
├── database/
│   └── repository.js           # Supabase query helpers
├── utils/
├── observability/              # Logging, metrics, supervisor
└── data/                       # Runtime data files (badge emoji mappings)
```

## Available Scripts

| Script | Description |
|---|---|
| `npm start` | Production start |
| `npm run dev` | Development with `--watch` auto-restart |
| `npm test` | Run tests |
| `npm run validate` | Lint + tests |
| `npm run lint` | ESLint |

## API Endpoints

All mounted at `/api/`:

- `GET /api/auth/*` — Discord OAuth2 flow
- `GET /api/dashboard/*` — Aggregated overview data
- `GET/PUT /api/guilds/*` — Guild management
- `GET/PUT /api/modules/*` — Module configs
- `GET /api/analytics/*` — Server analytics
- `GET/PUT /api/settings/*` — Guild settings
- `GET/POST /api/moderation/cases` — Moderation cases

WebSocket: `/overview` — real-time dashboard stats.

## Environment Variables

See [QUICK_START.md](../QUICK_START.md) for the full list. Required:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Module Registration

Modules auto-load from `src/modules/*/index.js`. Each exports:
```js
export default {
  name: 'module_name',
  configSchema: { ... },         // JSON schema for dashboard
  commands: [{ name, description, options, execute }],
  events: [{ name, execute }]
}
```
