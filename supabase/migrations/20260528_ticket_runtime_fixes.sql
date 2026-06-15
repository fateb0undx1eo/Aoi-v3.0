-- Runtime compatibility fixes for the modular tickets implementation.

-- The previous final migration created a full-table unique constraint on
-- (guild_id, creator_id). That prevents users from opening a new ticket after
-- an old one is resolved. Keep uniqueness only for active tickets.
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_guild_user_open_unique;

DROP INDEX IF EXISTS idx_tickets_one_active_per_creator;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_one_active_per_creator
  ON tickets(guild_id, creator_id)
  WHERE status IN ('open', 'in_progress', 'waiting_response');

-- User management handlers record add/remove actions. Create the table used by
-- the runtime so those actions are durable instead of only best-effort logs.
CREATE TABLE IF NOT EXISTS ticket_user_actions (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES tickets(thread_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('user_added', 'user_removed')),
  target_user_id TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ticket_user_actions_target_user_id_valid CHECK (target_user_id ~ '^\d{17,19}$'),
  CONSTRAINT ticket_user_actions_performed_by_valid CHECK (performed_by ~ '^\d{17,19}$')
);

CREATE INDEX IF NOT EXISTS idx_ticket_user_actions_thread_id
  ON ticket_user_actions(thread_id);

CREATE INDEX IF NOT EXISTS idx_ticket_user_actions_performed_at
  ON ticket_user_actions(performed_at DESC);

-- Ensure common runtime columns exist even when deployments were upgraded from
-- an older tickets schema.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS tag TEXT,
  ADD COLUMN IF NOT EXISTS tag_label TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS thread_name TEXT,
  ADD COLUMN IF NOT EXISTS original_thread_name TEXT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

UPDATE tickets
SET
  tag = COALESCE(tag, 'general_support'),
  tag_label = COALESCE(tag_label, 'General Support'),
  status = COALESCE(status, 'open'),
  updated_at = COALESCE(updated_at, created_at, NOW()),
  last_activity_at = COALESCE(last_activity_at, created_at, NOW())
WHERE tag IS NULL
   OR tag_label IS NULL
   OR status IS NULL
   OR updated_at IS NULL
   OR last_activity_at IS NULL;
