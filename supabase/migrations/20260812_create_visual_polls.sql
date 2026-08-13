-- Visual Poll Studio — poll definitions and per-user votes
-- Polls are sent to Discord as Components V2 messages; votes come back via
-- button interactions (community module) or emoji reactions.

create table if not exists visual_polls (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  message_id text,
  created_by text not null,
  type text not null default 'vs' check (type in ('vs', 'music')),
  title text not null,
  subtitle text not null default '',
  options jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ends_at timestamptz
);

create index idx_visual_polls_guild on visual_polls(guild_id);
create index idx_visual_polls_created on visual_polls(guild_id, created_at desc);

-- One row per user per poll. option_ids reflects the final selection
-- (single option for single-select polls, array for multi-select).
create table if not exists visual_poll_votes (
  poll_id uuid not null references visual_polls(id) on delete cascade,
  guild_id text not null,
  user_id text not null,
  option_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index idx_visual_poll_votes_poll on visual_poll_votes(poll_id);
create index idx_visual_poll_votes_guild on visual_poll_votes(guild_id);

-- RLS
alter table visual_polls enable row level security;
alter table visual_poll_votes enable row level security;

-- Readers: dashboard_access users of the guild
create policy "visual_polls_select" on visual_polls
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id
    )
  );

-- Writers: owners and managers
create policy "visual_polls_insert" on visual_polls
  for insert with check (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id and role in ('owner', 'manager')
    )
  );

create policy "visual_polls_update" on visual_polls
  for update using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id and role in ('owner', 'manager')
    )
  );

create policy "visual_polls_delete" on visual_polls
  for delete using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id and role in ('owner', 'manager')
    )
  );

-- Votes: anyone with dashboard_access can read; any authenticated user may vote
create policy "visual_poll_votes_select" on visual_poll_votes
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_poll_votes.guild_id
    )
  );

create policy "visual_poll_votes_insert" on visual_poll_votes
  for insert with check (
    auth.uid()::text is not null
  );

create policy "visual_poll_votes_update" on visual_poll_votes
  for update using (
    auth.uid()::text is not null
  );

create policy "visual_poll_votes_delete" on visual_poll_votes
  for delete using (
    auth.uid()::text is not null
  );

-- Auto-update updated_at
create or replace function update_visual_polls_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_visual_polls_timestamp_trigger
  before update on visual_polls
  for each row
  execute function update_visual_polls_timestamp();

create or replace function update_visual_poll_votes_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_visual_poll_votes_timestamp_trigger
  before update on visual_poll_votes
  for each row
  execute function update_visual_poll_votes_timestamp();