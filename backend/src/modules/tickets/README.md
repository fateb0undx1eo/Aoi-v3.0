# Tickets Module

Thread-based ticket system. When a user clicks a ticket panel button, a private thread is created in a configured channel.

## Commands

- `/ticket panel` — Sends the ticket creation panel (buttons) in the current channel
- `/ticket manage users` — Opens add/remove user controls for the current ticket thread

## Configuration (via Supabase `module_configs`)

- `category_id` — Category where ticket threads are created
- `transcript_channel_id` — Channel for closed ticket transcripts
- `support_role_ids` — Roles that can access all tickets
- `cooldown_seconds` — Per-user cooldown between ticket creation
- `allowed_roles` — Only users with these roles can create tickets
- `log_webhook_url` — Webhook for ticket audit logs
- `max_tickets_per_user` — Concurrent ticket limit per user

## Features

- Private threads with configurable access
- Add/remove users from tickets
- Close/reopen with logging
- Cooldown enforcement
- Webhook audit log
- Automatic reconciliation on startup
- Button panel UI (Components V2)
