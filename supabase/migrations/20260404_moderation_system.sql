-- Moderation cases table for tracking all moderation actions
CREATE TABLE mod_cases (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    case_number INTEGER NOT NULL, -- per-guild case number
    target_user_id TEXT NOT NULL, -- user who was punished
    target_username TEXT, -- cached username
    moderator_user_id TEXT NOT NULL, -- staff who took action
    moderator_username TEXT, -- cached username
    type TEXT NOT NULL, -- WARN, MUTE, KICK, BAN, TEMPBAN, TIMEOUT, UNBAN, NOTE
    reason TEXT,
    duration_seconds INTEGER, -- for temp actions
    expires_at TIMESTAMP, -- when temp action expires
    active BOOLEAN DEFAULT TRUE, -- for temp actions
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, case_number)
);

-- Moderation config per guild
CREATE TABLE mod_config (
    guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    modlog_channel_id TEXT, -- where to log mod actions
    mute_role_id TEXT, -- role used for mutes
    warn_auto_punish_enabled BOOLEAN DEFAULT FALSE,
    warn_threshold_1 INTEGER DEFAULT 3, -- warnings before action 1
    warn_action_1 TEXT DEFAULT 'MUTE', -- MUTE, KICK, BAN
    warn_duration_1 INTEGER DEFAULT 3600, -- seconds
    warn_threshold_2 INTEGER DEFAULT 5,
    warn_action_2 TEXT DEFAULT 'KICK',
    warn_duration_2 INTEGER DEFAULT NULL,
    warn_threshold_3 INTEGER DEFAULT 7,
    warn_action_3 TEXT DEFAULT 'BAN',
    warn_duration_3 INTEGER DEFAULT NULL,
    dm_on_punish BOOLEAN DEFAULT TRUE,
    show_mod_in_dm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Automod rules table
CREATE TABLE automod_rules (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    rule_type TEXT NOT NULL, -- SPAM, INVITES, BAD_WORDS, CAPS, MENTIONS, LINKS, RAID
    config JSONB DEFAULT '{}', -- rule-specific config
    actions JSONB DEFAULT '["DELETE"]', -- actions to take: DELETE, WARN, MUTE, KICK, BAN, TIMEOUT
    duration_seconds INTEGER, -- for mute/timeout/ban
    ignored_roles JSONB DEFAULT '[]',
    ignored_channels JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Reaction roles sets
CREATE TABLE reaction_role_sets (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    mode TEXT DEFAULT 'MULTI', -- MULTI, UNIQUE (only one role allowed)
    dm_notification BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual reaction role options
CREATE TABLE reaction_role_options (
    id SERIAL PRIMARY KEY,
    set_id INTEGER REFERENCES reaction_role_sets(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    role_id TEXT NOT NULL,
    label TEXT,
    remove_on_unreact BOOLEAN DEFAULT FALSE
);

-- Level/XP configuration
CREATE TABLE level_config (
    guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    xp_per_message_min INTEGER DEFAULT 15,
    xp_per_message_max INTEGER DEFAULT 25,
    cooldown_seconds INTEGER DEFAULT 60,
    announce_levelups BOOLEAN DEFAULT TRUE,
    levelup_channel_id TEXT, -- null = same channel
    levelup_message TEXT DEFAULT 'GG {user}, you reached level {level}!',
    leaderboard_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User XP/levels per guild
CREATE TABLE user_levels (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    last_xp_at TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);

-- Level role rewards
CREATE TABLE level_role_rewards (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    behavior TEXT DEFAULT 'ADD', -- ADD, REPLACE, STACK
    UNIQUE(guild_id, level)
);

-- Indexes for performance
CREATE INDEX idx_mod_cases_guild ON mod_cases(guild_id);
CREATE INDEX idx_mod_cases_target ON mod_cases(target_user_id);
CREATE INDEX idx_mod_cases_type ON mod_cases(type);
CREATE INDEX idx_mod_cases_active ON mod_cases(guild_id, active) WHERE active = TRUE;
CREATE INDEX idx_automod_rules_guild ON automod_rules(guild_id);
CREATE INDEX idx_reaction_role_sets_guild ON reaction_role_sets(guild_id);
CREATE INDEX idx_reaction_role_options_set ON reaction_role_options(set_id);
CREATE INDEX idx_user_levels_guild ON user_levels(guild_id);
CREATE INDEX idx_user_levels_xp ON user_levels(guild_id, xp DESC);
CREATE INDEX idx_level_role_rewards_guild ON level_role_rewards(guild_id);

-- Trigger for mod_cases updated_at
CREATE TRIGGER update_mod_cases_updated_at BEFORE UPDATE ON mod_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mod_config_updated_at BEFORE UPDATE ON mod_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automod_rules_updated_at BEFORE UPDATE ON automod_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reaction_role_sets_updated_at BEFORE UPDATE ON reaction_role_sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_level_config_updated_at BEFORE UPDATE ON level_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
