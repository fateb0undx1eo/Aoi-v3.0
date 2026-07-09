-- Create announcement_presets table for per-preset CRUD
-- Each preset is a separate row instead of a monolithic JSON blob in module_configs
create table if not exists announcement_presets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  name text not null,
  kind text not null default 'draft' check (kind in ('draft', 'template')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast guild lookups
create index idx_announcement_presets_guild on announcement_presets(guild_id);

-- Enable RLS
alter table announcement_presets enable row level security;

-- RLS: users with dashboard_access can read their guild's presets
create policy "announcement_presets_select" on announcement_presets
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = announcement_presets.guild_id
    )
  );

-- RLS: owners and managers can insert/update/delete presets
create policy "announcement_presets_insert" on announcement_presets
  for insert with check (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = announcement_presets.guild_id and role in ('owner', 'manager')
    )
  );

create policy "announcement_presets_update" on announcement_presets
  for update using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = announcement_presets.guild_id and role in ('owner', 'manager')
    )
  );

create policy "announcement_presets_delete" on announcement_presets
  for delete using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = announcement_presets.guild_id and role in ('owner', 'manager')
    )
  );

-- Auto-update updated_at
create or replace function update_announcement_presets_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_announcement_presets_timestamp_trigger
  before update on announcement_presets
  for each row
  execute function update_announcement_presets_timestamp();
