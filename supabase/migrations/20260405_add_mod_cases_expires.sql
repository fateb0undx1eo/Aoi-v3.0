-- Add expires_at column to mod_cases for temporary punishments
alter table mod_cases add column if not exists expires_at timestamptz;

-- Add index for querying active temporary punishments
create index if not exists idx_mod_cases_expires on mod_cases(guild_id, active, expires_at);
