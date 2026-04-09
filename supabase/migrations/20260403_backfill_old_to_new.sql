-- Run this AFTER 20260403_production_architecture.sql
-- Safe backfill from old schema -> new schema

alter table public.guilds add column if not exists branding jsonb not null default '{}'::jsonb;
alter table public.guilds add column if not exists stats jsonb not null default '{}'::jsonb;

update public.guilds
set stats = jsonb_build_object(
  'member_count', coalesce(member_count, 0),
  'boost_level', coalesce(boost_level, 0)
)
where stats = '{}'::jsonb;

alter table public.tickets add column if not exists requester_id text;
alter table public.tickets add column if not exists closed_by text;
alter table public.tickets add column if not exists panel_meta jsonb not null default '{}'::jsonb;

update public.tickets
set requester_id = user_id
where requester_id is null;

insert into public.module_configs (guild_id, module_name, enabled, config)
select gm.guild_id, m.name, gm.enabled, coalesce(gm.config, '{}'::jsonb)
from public.guild_modules gm
join public.modules m on m.id = gm.module_id
on conflict (guild_id, module_name) do nothing;

insert into public.command_configs (guild_id, command_name, enabled, overrides)
select gc.guild_id, c.name, gc.enabled,
       jsonb_build_object('custom_cooldown', gc.custom_cooldown)
from public.guild_commands gc
join public.commands c on c.id = gc.command_id
on conflict (guild_id, command_name) do nothing;

insert into public.logs_config (guild_id, event_name, channel_id, enabled)
select guild_id, event_type, channel_id, enabled
from public.guild_logs
on conflict (guild_id, event_name) do nothing;

insert into public.analytics (guild_id, date_bucket, metrics)
select guild_id, date,
       jsonb_build_object(
         'member_count', member_count,
         'human_count', human_count,
         'bot_count', bot_count
       )
from public.member_analytics
on conflict (guild_id, date_bucket) do nothing;
