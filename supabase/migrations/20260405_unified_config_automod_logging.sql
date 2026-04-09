-- Unified guild configuration system for all modules
-- This replaces scattered config tables with a single extensible schema

-- Main config table for all features
CREATE TABLE IF NOT EXISTS guild_configs_v2 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    module TEXT NOT NULL,           -- 'automod', 'logging', 'welcome', 'moderation', etc.
    feature TEXT NOT NULL,          -- 'spam_filter', 'message_delete', 'join_message', etc.
    config_json JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guild_id, module, feature)
);

-- Enable RLS
ALTER TABLE guild_configs_v2 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "guild_configs_v2_select" ON guild_configs_v2;
DROP POLICY IF EXISTS "guild_configs_v2_insert" ON guild_configs_v2;
DROP POLICY IF EXISTS "guild_configs_v2_update" ON guild_configs_v2;
DROP POLICY IF EXISTS "guild_configs_v2_delete" ON guild_configs_v2;

-- RLS policies
CREATE POLICY "guild_configs_v2_select" ON guild_configs_v2 FOR SELECT USING (true);
CREATE POLICY "guild_configs_v2_insert" ON guild_configs_v2 FOR INSERT WITH CHECK (true);
CREATE POLICY "guild_configs_v2_update" ON guild_configs_v2 FOR UPDATE USING (true);
CREATE POLICY "guild_configs_v2_delete" ON guild_configs_v2 FOR DELETE USING (true);

-- Indexes for fast lookups
DROP INDEX IF EXISTS idx_guild_configs_v2_guild;
DROP INDEX IF EXISTS idx_guild_configs_v2_module;
DROP INDEX IF EXISTS idx_guild_configs_v2_feature;
DROP INDEX IF EXISTS idx_guild_configs_v2_enabled;

CREATE INDEX idx_guild_configs_v2_guild ON guild_configs_v2(guild_id);
CREATE INDEX idx_guild_configs_v2_module ON guild_configs_v2(guild_id, module);
CREATE INDEX idx_guild_configs_v2_feature ON guild_configs_v2(guild_id, module, feature);
CREATE INDEX idx_guild_configs_v2_enabled ON guild_configs_v2(guild_id, is_enabled);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_guild_configs_v2_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_guild_configs_v2 ON guild_configs_v2;

CREATE TRIGGER trigger_update_guild_configs_v2
    BEFORE UPDATE ON guild_configs_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_guild_configs_v2_timestamp();

-- ============================================
-- AUTOMOD SYSTEM
-- ============================================

-- AutoMod violations log
CREATE TABLE IF NOT EXISTS automod_violations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    violation_type TEXT NOT NULL,   -- 'spam', 'word_filter', 'mention_spam', 'caps', 'link', 'emoji_spam'
    severity INTEGER NOT NULL DEFAULT 1,  -- 1=warn, 2=mute, 3=kick, 4=ban
    message_content TEXT,
    channel_id BIGINT,
    message_id BIGINT,
    action_taken TEXT,              -- 'warned', 'muted', 'kicked', 'banned', 'deleted', 'notified'
    triggered_by TEXT NOT NULL,     -- 'automod', 'manual'
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,         -- For temporary violations
    metadata JSONB DEFAULT '{}'     -- Extra data like matched words, spam score, etc.
);

-- Enable RLS
ALTER TABLE automod_violations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "automod_violations_select" ON automod_violations;
DROP POLICY IF EXISTS "automod_violations_insert" ON automod_violations;
DROP POLICY IF EXISTS "automod_violations_update" ON automod_violations;
DROP POLICY IF EXISTS "automod_violations_delete" ON automod_violations;

-- RLS policies
CREATE POLICY "automod_violations_select" ON automod_violations FOR SELECT USING (true);
CREATE POLICY "automod_violations_insert" ON automod_violations FOR INSERT WITH CHECK (true);
CREATE POLICY "automod_violations_update" ON automod_violations FOR UPDATE USING (true);
CREATE POLICY "automod_violations_delete" ON automod_violations FOR DELETE USING (true);

-- Indexes
DROP INDEX IF EXISTS idx_automod_violations_guild;
DROP INDEX IF EXISTS idx_automod_violations_user;
DROP INDEX IF EXISTS idx_automod_violations_type;
DROP INDEX IF EXISTS idx_automod_violations_triggered;
DROP INDEX IF EXISTS idx_automod_violations_expires;

CREATE INDEX idx_automod_violations_guild ON automod_violations(guild_id);
CREATE INDEX idx_automod_violations_user ON automod_violations(guild_id, user_id);
CREATE INDEX idx_automod_violations_type ON automod_violations(guild_id, violation_type);
CREATE INDEX idx_automod_violations_triggered ON automod_violations(guild_id, triggered_at DESC);
CREATE INDEX idx_automod_violations_expires ON automod_violations(guild_id, user_id, expires_at);

-- ============================================
-- LOGGING SYSTEM
-- ============================================

-- Log entries
CREATE TABLE IF NOT EXISTS log_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    event_type TEXT NOT NULL,       -- 'message_delete', 'message_edit', 'member_join', etc.
    channel_id BIGINT,
    user_id BIGINT,
    target_id BIGINT,               -- For actions on other users (e.g., mod actions)
    content TEXT,                   -- For message content
    old_value TEXT,                 -- For edits/changes (previous state)
    new_value TEXT,                 -- For edits/changes (new state)
    metadata JSONB DEFAULT '{}',   -- Extra event-specific data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    log_message_id BIGINT           -- ID of the message sent to log channel
);

-- Enable RLS
ALTER TABLE log_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "log_entries_select" ON log_entries;
DROP POLICY IF EXISTS "log_entries_insert" ON log_entries;
DROP POLICY IF EXISTS "log_entries_delete" ON log_entries;

-- RLS policies
CREATE POLICY "log_entries_select" ON log_entries FOR SELECT USING (true);
CREATE POLICY "log_entries_insert" ON log_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "log_entries_delete" ON log_entries FOR DELETE USING (true);

-- Indexes
DROP INDEX IF EXISTS idx_log_entries_guild;
DROP INDEX IF EXISTS idx_log_entries_event;
DROP INDEX IF EXISTS idx_log_entries_created;
DROP INDEX IF EXISTS idx_log_entries_user;

CREATE INDEX idx_log_entries_guild ON log_entries(guild_id);
CREATE INDEX idx_log_entries_event ON log_entries(guild_id, event_type);
CREATE INDEX idx_log_entries_created ON log_entries(guild_id, created_at DESC);
CREATE INDEX idx_log_entries_user ON log_entries(guild_id, user_id);

-- ============================================
-- WELCOME SYSTEM
-- ============================================

-- Welcome messages sent (for stats/tracking)
CREATE TABLE IF NOT EXISTS welcome_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'embed',  -- 'embed', 'text', 'image'
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE welcome_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "welcome_messages_select" ON welcome_messages;
DROP POLICY IF EXISTS "welcome_messages_insert" ON welcome_messages;
DROP POLICY IF EXISTS "welcome_messages_delete" ON welcome_messages;

-- RLS policies
CREATE POLICY "welcome_messages_select" ON welcome_messages FOR SELECT USING (true);
CREATE POLICY "welcome_messages_insert" ON welcome_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "welcome_messages_delete" ON welcome_messages FOR DELETE USING (true);

-- Indexes
DROP INDEX IF EXISTS idx_welcome_messages_guild;
DROP INDEX IF EXISTS idx_welcome_messages_user;

CREATE INDEX idx_welcome_messages_guild ON welcome_messages(guild_id);
CREATE INDEX idx_welcome_messages_user ON welcome_messages(guild_id, user_id);

-- ============================================
-- DEFAULT CONFIG TEMPLATES
-- ============================================

-- Insert default AutoMod config for new guilds
CREATE OR REPLACE FUNCTION insert_default_configs_on_guild_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- AutoMod defaults
    INSERT INTO guild_configs_v2 (guild_id, module, feature, config_json, is_enabled) VALUES
        (NEW.guild_id, 'automod', 'spam', '{"enabled": false, "threshold": 5, "window_seconds": 5, "action": "warn"}'::jsonb, false),
        (NEW.guild_id, 'automod', 'word_filter', '{"enabled": false, "words": [], "action": "delete"}'::jsonb, false),
        (NEW.guild_id, 'automod', 'mention_spam', '{"enabled": false, "threshold": 5, "action": "warn"}'::jsonb, false),
        (NEW.guild_id, 'automod', 'caps', '{"enabled": false, "threshold_percent": 70, "min_length": 10, "action": "warn"}'::jsonb, false),
        (NEW.guild_id, 'automod', 'link_filter', '{"enabled": false, "whitelist": [], "blacklist": [], "action": "delete"}'::jsonb, false),
        (NEW.guild_id, 'automod', 'emoji_spam', '{"enabled": false, "threshold": 10, "action": "warn"}'::jsonb, false)
    ON CONFLICT (guild_id, module, feature) DO NOTHING;
    
    -- Logging defaults
    INSERT INTO guild_configs_v2 (guild_id, module, feature, config_json, is_enabled) VALUES
        (NEW.guild_id, 'logging', 'message_delete', '{"enabled": false, "channel_id": null, "ignore_bots": true}'::jsonb, false),
        (NEW.guild_id, 'logging', 'message_edit', '{"enabled": false, "channel_id": null}'::jsonb, false),
        (NEW.guild_id, 'logging', 'member_join', '{"enabled": false, "channel_id": null}'::jsonb, false),
        (NEW.guild_id, 'logging', 'member_leave', '{"enabled": false, "channel_id": null}'::jsonb, false),
        (NEW.guild_id, 'logging', 'role_changes', '{"enabled": false, "channel_id": null}'::jsonb, false),
        (NEW.guild_id, 'logging', 'voice_activity', '{"enabled": false, "channel_id": null}'::jsonb, false)
    ON CONFLICT (guild_id, module, feature) DO NOTHING;
    
    -- Welcome defaults
    INSERT INTO guild_configs_v2 (guild_id, module, feature, config_json, is_enabled) VALUES
        (NEW.guild_id, 'welcome', 'join_message', '{"enabled": false, "channel_id": null, "message": "Welcome {user} to {server}!", "dm": false, "dm_message": null}'::jsonb, false)
    ON CONFLICT (guild_id, module, feature) DO NOTHING;
    
    -- Data retention settings (7 days default for free tier)
    INSERT INTO guild_configs_v2 (guild_id, module, feature, config_json, is_enabled) VALUES
        (NEW.guild_id, 'settings', 'data_retention', '{"automod_violations_days": 7, "log_entries_days": 7, "max_violations_per_user": 100, "max_logs_per_guild": 1000}'::jsonb, true)
    ON CONFLICT (guild_id, module, feature) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to guild_configs (main guild table) if exists
-- Otherwise, this should be called manually when guild is registered

COMMENT ON TABLE guild_configs_v2 IS 'Unified configuration for all bot features per guild';
COMMENT ON TABLE automod_violations IS 'Log of AutoMod violations for user tracking';
COMMENT ON TABLE log_entries IS 'Audit log of Discord events';
COMMENT ON TABLE welcome_messages IS 'History of welcome messages sent';
