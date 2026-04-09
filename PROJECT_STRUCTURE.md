# Project Structure

## Active Apps

```text
/
|-- backend/   # Discord runtime + Express API
|-- landing/   # Marketing site + thin dashboard frontend
`-- supabase/  # SQL migrations
```

## Backend Layout

```text
backend/
|-- src/api/          # Express routes and middleware
|-- src/core/         # loaders, config, cache, permissions, placeholders
|-- src/database/     # Supabase client and repository helpers
|-- src/events/       # Discord event dispatcher
|-- src/interactions/ # slash command routing
|-- src/modules/      # module definitions
|-- src/services/     # business logic
`-- src/index.js      # main runtime entry
```

## Landing Layout

```text
landing/
|-- src/components/   # shared UI
|-- src/lib/          # frontend helpers and backend URL helpers
|-- src/pages/        # landing pages, dashboard pages, thin API proxies
`-- src/styles/       # global styles
```

## Architecture Notes

- Only `backend/` talks to Discord and the database directly.
- `landing/` should proxy auth and dashboard requests to the backend instead of owning data logic.
- Dashboard pages should only exist when the corresponding backend surface is real and supported.
