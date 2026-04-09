-- Create mod_config table for guild moderation settings
create table if not exists mod_config (
  id uuid default gen_random_uuid() primary key,
  guild_id bigint not null unique references guild_configs(guild_id) on delete cascade,
  mute_role_id bigint,
  log_channel_id bigint,
  max_warnings int default 3,
  warning_action text default 'KICK', -- KICK, BAN, MUTE, TIMEOUT
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table mod_config enable row level security;

-- RLS policies
create policy "mod_config select" on mod_config for select using (true);
create policy "mod_config insert" on mod_config for insert with check (true);
create policy "mod_config update" on mod_config for update using (true);
create policy "mod_config delete" on mod_config for delete using (true);

-- Index
create index if not exists idx_mod_config_guild on mod_config(guild_id);
