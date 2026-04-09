-- Create moderation cases table
-- Stores all moderation actions (warns, kicks, bans, mutes, etc.)

create table if not exists mod_cases (
  id uuid primary key default gen_random_uuid(),
  case_number int not null,
  guild_id text not null references guilds(id) on delete cascade,
  target_user_id text not null,
  target_username text not null default '',
  moderator_user_id text not null,
  moderator_username text not null default '',
  type text not null check (type in ('WARN', 'KICK', 'BAN', 'TEMPBAN', 'MUTE', 'TIMEOUT', 'UNBAN', 'UNMUTE', 'NOTE')),
  reason text not null default '',
  duration_seconds int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, case_number)
);

-- Create index for faster lookups by guild
create index if not exists idx_mod_cases_guild_id on mod_cases(guild_id);
create index if not exists idx_mod_cases_target_user on mod_cases(guild_id, target_user_id);
create index if not exists idx_mod_cases_type on mod_cases(guild_id, type);
create index if not exists idx_mod_cases_active on mod_cases(guild_id, active);
create index if not exists idx_mod_cases_created on mod_cases(guild_id, created_at desc);

-- Create a sequence for case numbers per guild
-- This is managed in application code

-- Enable RLS
alter table mod_cases enable row level security;

-- Create policies
-- Guild members can view their own cases
-- Guild managers can view all cases in their guild
create policy "mod_cases_select_guild" on mod_cases
  for select using (auth.uid()::text in (
    select user_id from dashboard_access where guild_id = mod_cases.guild_id
  ));

create policy "mod_cases_insert_guild" on mod_cases
  for insert with check (auth.uid()::text in (
    select user_id from dashboard_access where guild_id = mod_cases.guild_id and role in ('owner', 'manager')
  ));

create policy "mod_cases_update_guild" on mod_cases
  for update using (auth.uid()::text in (
    select user_id from dashboard_access where guild_id = mod_cases.guild_id and role in ('owner', 'manager')
  ));

-- Add comments for documentation
comment on table mod_cases is 'Stores moderation action records for each guild';
comment on column mod_cases.type is 'Type of moderation action: WARN, KICK, BAN, TEMPBAN, MUTE, TIMEOUT, UNBAN, UNMUTE, NOTE';
comment on column mod_cases.active is 'For temporary actions (bans/mutes), indicates if still active';
