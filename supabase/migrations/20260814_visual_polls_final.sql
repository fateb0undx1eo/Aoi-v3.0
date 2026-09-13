-- Visual Polls — single merged migration (replaces
-- 20260812_create_visual_polls.sql + 20260813_allow_music_poll_type.sql).
-- Run this once in the Supabase SQL editor.
--
-- Model: polls are TEMPORARY rows. When a poll ends (expiry sweep) or is
-- deleted from the dashboard, the bot bakes the final tally into the
-- Discord message ("Final — sonic:3 • speed:5" or
-- "Final — track:listen:2 • track:skip:7") and deletes the poll + votes
-- rows, so these tables only ever hold OPEN polls. Nothing to prune by hand.

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
  -- Raw counters keyed by internal option ids. The bot reads these at close
  -- time and resolves them to label tallies before deleting the row:
  --   versus  -> { "<label>": <votes> }            e.g. sonic:3, speed:5
  --   music   -> { "<label>:listen"/":skip" }      e.g. track:listen:2, track:skip:7
  -- Labels are placeholders resolved at close time — whatever the user
  -- named each option is what shows in the baked "Final — …" line.
  results jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ends_at timestamptz
);

-- Normalize the type check on databases created by the older files
-- (20260812 shipped a narrower check; 20260813 widened it via alter).
-- On a fresh DB this just names the check the create-table already implies.
alter table visual_polls
  drop constraint if exists visual_polls_type_check;

alter table visual_polls
  add constraint visual_polls_type_check
  check (type in ('vs', 'music'));

alter table visual_polls
  alter column type set default 'vs';

create index if not exists idx_visual_polls_guild on visual_polls(guild_id);
create index if not exists idx_visual_polls_created on visual_polls(guild_id, created_at desc);
create index if not exists idx_visual_polls_expiry on visual_polls(status, ends_at);

-- One row per user per poll. option_ids holds the raw vote keys
-- (single option id, array for multi-select, "<id>:listen"/"<id>:skip"
-- for music polls). Deleted with the poll row via on delete cascade.
create table if not exists visual_poll_votes (
  poll_id uuid not null references visual_polls(id) on delete cascade,
  guild_id text not null,
  user_id text not null,
  option_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists idx_visual_poll_votes_poll on visual_poll_votes(poll_id);
create index if not exists idx_visual_poll_votes_guild on visual_poll_votes(guild_id);

-- RLS (bot uses the service key and bypasses these; they gate dashboard keys)
alter table visual_polls enable row level security;
alter table visual_poll_votes enable row level security;

drop policy if exists "visual_polls_select" on visual_polls;
create policy "visual_polls_select" on visual_polls
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id
    )
  );

drop policy if exists "visual_polls_insert" on visual_polls;
create policy "visual_polls_insert" on visual_polls
  for insert with check (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id and role in ('owner', 'manager')
    )
  );

drop policy if exists "visual_polls_update" on visual_polls;
create policy "visual_polls_update" on visual_polls
  for update using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id and role in ('owner', 'manager')
    )
  );

drop policy if exists "visual_polls_delete" on visual_polls;
create policy "visual_polls_delete" on visual_polls
  for delete using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_polls.guild_id and role in ('owner', 'manager')
    )
  );

drop policy if exists "visual_poll_votes_select" on visual_poll_votes;
create policy "visual_poll_votes_select" on visual_poll_votes
  for select using (
    auth.uid()::text in (
      select user_id from dashboard_access where guild_id::text = visual_poll_votes.guild_id
    )
  );

drop policy if exists "visual_poll_votes_insert" on visual_poll_votes;
create policy "visual_poll_votes_insert" on visual_poll_votes
  for insert with check (
    auth.uid()::text is not null
  );

drop policy if exists "visual_poll_votes_update" on visual_poll_votes;
create policy "visual_poll_votes_update" on visual_poll_votes
  for update using (
    auth.uid()::text is not null
  );

drop policy if exists "visual_poll_votes_delete" on visual_poll_votes;
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

drop trigger if exists update_visual_polls_timestamp_trigger on visual_polls;
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

drop trigger if exists update_visual_poll_votes_timestamp_trigger on visual_poll_votes;
create trigger update_visual_poll_votes_timestamp_trigger
  before update on visual_poll_votes
  for each row
  execute function update_visual_poll_votes_timestamp();
