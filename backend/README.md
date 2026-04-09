# Backend Architecture

## Core Principles
- `Command -> Service -> DB -> Discord`
- `Dashboard -> API -> Service -> DB`
- `Event -> Dispatcher -> Module -> Feature`
- Commands/routes do not contain DB logic.

## Runtime Composition
- Discord bot runtime and API runtime are bootstrapped in `src/index.js`.
- Modules/plugins are auto-loaded from `src/modules/*/index.js` and `src/plugins/*/index.js`.
- Configs are persisted in Supabase tables and cached by `ConfigCache`.
- Interaction handling uses deferred replies by default.

## Required Systems
- Dynamic module/plugin loader: `src/core/loader/*`
- Central event dispatcher: `src/events/dispatcher.js`
- Placeholder engine: `src/core/placeholderEngine/placeholderEngine.js`
- Permissions: `src/core/permissions/permissionService.js`
- Dynamic rate limits from DB: `src/core/rateLimiter/dynamicRateLimiter.js`

## API Surface
- `/api/auth/*`
- `/api/dashboard/*`
- `/api/guilds/*`
- `/api/modules/*`
- `/api/analytics/*`
- `/api/settings/*`
- `/api/moderation/*`

## Schema
- Migration: `supabase/migrations/20260403_production_architecture.sql`
- Includes the current consolidated backend schema.
