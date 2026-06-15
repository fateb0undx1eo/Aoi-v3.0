-- Ticket blacklist table (durable storage, survives restarts)
create table if not exists ticket_blacklist (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  added_by text not null,
  created_at timestamptz not null default now(),
  unique (guild_id, user_id)
);

create index if not exists idx_ticket_blacklist_guild on ticket_blacklist(guild_id);
create index if not exists idx_ticket_blacklist_user on ticket_blacklist(guild_id, user_id);

-- Enable RLS
alter table ticket_blacklist enable row level security;

-- RLS: users can view their own blacklist status, guild managers can manage
create policy "ticket_blacklist_select" on ticket_blacklist
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_blacklist.guild_id::text
    )
  );

create policy "ticket_blacklist_insert" on ticket_blacklist
  for insert with check (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_blacklist.guild_id::text and role in ('owner', 'manager')
    )
  );

create policy "ticket_blacklist_delete" on ticket_blacklist
  for delete using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_blacklist.guild_id::text and role in ('owner', 'manager')
    )
  );

-- Ticket cooldowns table (durable storage, survives restarts)
-- Drop old schema first (it was never used by runtime code)
drop table if exists ticket_cooldowns cascade;

create table ticket_cooldowns (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  closed_at timestamptz not null default now(),
  cooldown_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (guild_id, user_id)
);

create index if not exists idx_ticket_cooldowns_guild on ticket_cooldowns(guild_id);
create index if not exists idx_ticket_cooldowns_user on ticket_cooldowns(guild_id, user_id);
create index if not exists idx_ticket_cooldowns_ends on ticket_cooldowns(cooldown_ends_at);

-- Enable RLS
alter table ticket_cooldowns enable row level security;

create policy "ticket_cooldowns_select" on ticket_cooldowns
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_cooldowns.guild_id::text
    )
  );

create policy "ticket_cooldowns_insert" on ticket_cooldowns
  for insert with check (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_cooldowns.guild_id::text
    )
  );

create policy "ticket_cooldowns_delete" on ticket_cooldowns
  for delete using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = ticket_cooldowns.guild_id::text
    )
  );

-- Auto-cleanup function
create or replace function cleanup_expired_cooldowns()
returns integer as $$
declare
  deleted_count integer;
begin
  delete from ticket_cooldowns where cooldown_ends_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql;
