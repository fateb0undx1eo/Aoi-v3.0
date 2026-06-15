-- Create ticket_configs table for persistent guild configuration
-- This table stores per-guild ticket system settings
create table if not exists ticket_configs (
  guild_id text primary key,
  staff_role_ids jsonb not null default '[]'::jsonb,
  log_channel_id text not null default '',
  add_staff_to_thread boolean not null default true,
  cooldown_ms bigint not null default 0,
  auto_archive_24h integer not null default 10080,
  auto_archive_1h integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table ticket_configs enable row level security;

-- RLS: users with dashboard_access can read their guild's config
create policy "ticket_configs_select" on ticket_configs
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_configs.guild_id
    )
  );

-- RLS: owners and managers can update config
create policy "ticket_configs_insert" on ticket_configs
  for insert with check (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_configs.guild_id and role in ('owner', 'manager')
    )
  );

create policy "ticket_configs_update" on ticket_configs
  for update using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_configs.guild_id and role in ('owner', 'manager')
    )
  );

-- Auto-update updated_at on row modification
create or replace function update_ticket_configs_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_ticket_configs_timestamp_trigger
  before update on ticket_configs
  for each row
  execute function update_ticket_configs_timestamp();
