# Project Structure

```
aoi-v3/
├── README.md                       # This file
├── QUICK_START.md                  # Setup guide
├── DEPLOYMENT.md                   # Deployment instructions
├── PROJECT_STRUCTURE.md            # This file
└── backend/
    ├── README.md                   # Backend-specific docs
    ├── package.json
    ├── .env                        # Environment variables (gitignored)
    ├── src/
    │   ├── main.js                 # Entry point — init order:
    │   │                           #   1. Redis → 2. DB → 3. Discord client
    │   │                           #   4. Load modules → 5. Init async modules
    │   │                           #   6. Register handlers → 7. Sync commands
    │   │                           #   8. Start API server → 9. Login
    │   │
    │   ├── core/
    │   │   ├── config/
    │   │   │   └── env.js          # Validates & exports environment vars
    │   │   ├── loader/
    │   │   │   └── bootstrap.js    # Auto-discovers & loads modules
    │   │   ├── permissions/
    │   │   │   └── permissionService.js
    │   │   ├── rateLimiter/
    │   │   │   └── dynamicRateLimiter.js
    │   │   ├── configCache/
    │   │   │   └── configCache.js  # Guild config cache with auto-refresh
    │   │   ├── placeholderEngine/
    │   │   │   └── placeholderEngine.js
    │   │   ├── queue/
    │   │   │   └── jobQueue.js
    │   │   └── redis.js
    │   │
    │   ├── modules/                # Auto-loaded — each is self-contained
    │   │   ├── community/          # 6 commands, passive features
    │   │   ├── fun/                # /waifu, /husbando
    │   │   ├── moderation/         # /case (context menu)
    │   │   ├── tickets/            # Thread-based tickets
    │   │   ├── tools/              # /channel broadcast
    │   │   ├── settings/           # Schema only (dashboard)
    │   │   └── userinfo/           # /user info
    │   │
    │   ├── services/               # Business logic classes
    │   ├── interactions/
    │   │   └── interactionRouter.js
    │   ├── api/
    │   │   ├── server.js
    │   │   └── routes/             # Express route handlers
    │   ├── database/
    │   │   └── repository.js
    │   ├── utils/
    │   └── observability/
    │       ├── logger.js
    │       ├── metrics.js
    │       ├── runtimeState.js
    │       ├── supervisor.js
    │       └── runtimeFaults.js
    │
    ├── data/                       # Runtime data (badge emoji cache)
    └── tests/
```

## Key Architecture Decisions

- **Modules are self-contained**: Each module exports commands, events, and a config schema. The registry auto-loads them all.
- **Events fire in registration order**: Module event handlers run before the interaction router for `interactionCreate`.
- **Context object**: Passed to all command/event `execute()` functions — contains all services, the Discord client, env, and more.
- **Services object**: A convenience `services` property on context groups all service instances for easy destructuring.
- **Config cache**: Guild configs are cached in memory and auto-refreshed on an interval. Module configs stored as JSON blobs in Supabase.
- **Components V2**: Newer features use `MessageFlags.IsComponentsV2` with raw JSON container components (types 9, 10, 11, 12, 17).
