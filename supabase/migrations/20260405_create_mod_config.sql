-- mod_config is already created in 20260404_moderation_system.sql
-- This migration ensures columns from the new schema exist
DO $$
BEGIN
  -- Add columns if they don't exist in the already-created table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mod_config' AND column_name = 'mute_role_id') THEN
    ALTER TABLE mod_config ADD COLUMN mute_role_id bigint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mod_config' AND column_name = 'log_channel_id') THEN
    ALTER TABLE mod_config ADD COLUMN log_channel_id bigint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mod_config' AND column_name = 'max_warnings') THEN
    ALTER TABLE mod_config ADD COLUMN max_warnings int default 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mod_config' AND column_name = 'warning_action') THEN
    ALTER TABLE mod_config ADD COLUMN warning_action text default 'KICK';
  END IF;
END $$;

-- Enable RLS
alter table mod_config enable row level security;

-- RLS policies
create policy "mod_config select" on mod_config for select using (
  auth.uid()::text in (select user_id from dashboard_access where guild_id::text = mod_config.guild_id::text)
);
create policy "mod_config insert" on mod_config for insert with check (
  auth.uid()::text in (select user_id from dashboard_access where guild_id::text = mod_config.guild_id::text and role in ('owner', 'manager'))
);
create policy "mod_config update" on mod_config for update using (
  auth.uid()::text in (select user_id from dashboard_access where guild_id::text = mod_config.guild_id::text and role in ('owner', 'manager'))
);
create policy "mod_config delete" on mod_config for delete using (
  auth.uid()::text in (select user_id from dashboard_access where guild_id::text = mod_config.guild_id::text and role in ('owner', 'manager'))
);

-- Index
create index if not exists idx_mod_config_guild on mod_config(guild_id);
