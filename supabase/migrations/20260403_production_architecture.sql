-- Production-grade Discord Ecosystem Schema
-- Includes mandatory tables:
-- guilds, module_configs, command_configs, analytics, staff_ratings, tickets, logs_config

create extension if not exists pgcrypto;

create table if not exists guilds (
  id text primary key,
  name text not null,
  icon text,
  owner_id text not null,
  prefix text not null default '!',
  branding jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists module_configs (
  guild_id text not null references guilds(id) on delete cascade,
  module_name text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (guild_id, module_name)
);

create table if not exists command_configs (
  guild_id text not null references guilds(id) on delete cascade,
  command_name text not null,
  enabled boolean not null default true,
  overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (guild_id, command_name)
);

create table if not exists logs_config (
  guild_id text not null references guilds(id) on delete cascade,
  event_name text not null,
  channel_id text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (guild_id, event_name)
);

create table if not exists dashboard_access (
  guild_id text not null references guilds(id) on delete cascade,
  user_id text not null,
  role text not null default 'viewer' check (role in ('owner', 'manager', 'viewer')),
  allowed_role_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists analytics (
  guild_id text not null references guilds(id) on delete cascade,
  date_bucket date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (guild_id, date_bucket)
);

create table if not exists staff_ratings (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guilds(id) on delete cascade,
  staff_user_id text not null,
  reviewer_user_id text not null,
  stars int not null check (stars between 1 and 5),
  review_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guilds(id) on delete cascade,
  channel_id text not null,
  requester_id text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by text,
  panel_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (guild_id, channel_id)
);

create table if not exists rate_limit_rules (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guilds(id) on delete cascade,
  command_name text not null,
  scope text not null check (scope in ('user', 'role', 'channel')),
  target_id text,
  window_seconds int not null check (window_seconds > 0),
  max_uses int not null check (max_uses > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists uwu_locks (
  guild_id text not null references guilds(id) on delete cascade,
  user_id text not null,
  settings jsonb not null default '{"delete_non_uwu":true,"notify":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists afk_states (
  guild_id text not null references guilds(id) on delete cascade,
  user_id text not null,
  reason text not null,
  since_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists loa_states (
  guild_id text not null references guilds(id) on delete cascade,
  user_id text not null,
  reason text not null,
  role_priority int not null default 0,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists ghost_ping_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guilds(id) on delete cascade,
  message_id text not null,
  channel_id text not null,
  author_id text,
  mentions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists meme_fetch_stats (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guilds(id) on delete cascade,
  subreddit text not null,
  result_count int not null default 0,
  fetched_at timestamptz not null default now()
);

create table if not exists autoresponders (
  guild_id text not null references guilds(id) on delete cascade,
  trigger_pattern text not null,
  response_template text not null,
  match_type text not null default 'contains' check (match_type in ('contains', 'exact', 'starts_with', 'ends_with')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (guild_id, trigger_pattern)
);

create table if not exists sticky_messages (
  guild_id text not null references guilds(id) on delete cascade,
  channel_id text not null,
  message_template text not null,
  last_message_id text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

create table if not exists embed_templates (
  guild_id text not null references guilds(id) on delete cascade,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (guild_id, name)
);

create index if not exists idx_module_configs_guild on module_configs(guild_id);
create index if not exists idx_command_configs_guild on command_configs(guild_id);
create index if not exists idx_logs_config_guild on logs_config(guild_id);
create index if not exists idx_dashboard_access_lookup on dashboard_access(guild_id, user_id);
create index if not exists idx_analytics_bucket on analytics(guild_id, date_bucket desc);
create index if not exists idx_staff_ratings_guild_staff on staff_ratings(guild_id, staff_user_id);
create index if not exists idx_tickets_guild_status on tickets(guild_id, status);
create index if not exists idx_rate_limit_rules_lookup on rate_limit_rules(guild_id, command_name, scope, target_id);
create index if not exists idx_loa_states_guild_active on loa_states(guild_id, active, role_priority desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_guilds_updated_at on guilds;
create trigger trg_guilds_updated_at before update on guilds
for each row execute function set_updated_at();

drop trigger if exists trg_module_configs_updated_at on module_configs;
create trigger trg_module_configs_updated_at before update on module_configs
for each row execute function set_updated_at();

drop trigger if exists trg_command_configs_updated_at on command_configs;
create trigger trg_command_configs_updated_at before update on command_configs
for each row execute function set_updated_at();

drop trigger if exists trg_logs_config_updated_at on logs_config;
create trigger trg_logs_config_updated_at before update on logs_config
for each row execute function set_updated_at();

drop trigger if exists trg_dashboard_access_updated_at on dashboard_access;
create trigger trg_dashboard_access_updated_at before update on dashboard_access
for each row execute function set_updated_at();

drop trigger if exists trg_uwu_locks_updated_at on uwu_locks;
create trigger trg_uwu_locks_updated_at before update on uwu_locks
for each row execute function set_updated_at();

drop trigger if exists trg_afk_states_updated_at on afk_states;
create trigger trg_afk_states_updated_at before update on afk_states
for each row execute function set_updated_at();

drop trigger if exists trg_loa_states_updated_at on loa_states;
create trigger trg_loa_states_updated_at before update on loa_states
for each row execute function set_updated_at();

drop trigger if exists trg_sticky_messages_updated_at on sticky_messages;
create trigger trg_sticky_messages_updated_at before update on sticky_messages
for each row execute function set_updated_at();

drop trigger if exists trg_embed_templates_updated_at on embed_templates;
create trigger trg_embed_templates_updated_at before update on embed_templates
for each row execute function set_updated_at();

create or replace function cleanup_analytics_30_days()
returns void
language sql
as $$
  delete from analytics
  where date_bucket < current_date - interval '30 days';
$$;

-- Optional scheduling with pg_cron (enable extension in Supabase if not already available)
create extension if not exists pg_cron;
do $cron$
begin
  if not exists (
    select 1 from cron.job where jobname = 'cleanup_analytics_30_days_daily'
  ) then
    perform cron.schedule(
      'cleanup_analytics_30_days_daily',
      '15 2 * * *',
      'select cleanup_analytics_30_days();'
    );
  end if;
exception
  when others then
    -- pg_cron may be unavailable in some projects; cleanup function still exists for manual scheduling.
    null;
end
$cron$;
