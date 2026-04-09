-- Discord Bot System - Supabase Schema

-- Guilds table
CREATE TABLE guilds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    owner_id TEXT NOT NULL,
    member_count INTEGER DEFAULT 0,
    boost_level INTEGER DEFAULT 0,
    prefix TEXT DEFAULT '!',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table (for dashboard access)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    discriminator TEXT,
    avatar TEXT,
    email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Guild members with dashboard roles
CREATE TABLE guild_members (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    dashboard_role TEXT DEFAULT 'member', -- owner, admin, moderator, member
    PRIMARY KEY (guild_id, user_id)
);

-- Modules table
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- moderation, community, tools, fun, etc.
    icon TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Guild modules (enabled/disabled per guild)
CREATE TABLE guild_modules (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    PRIMARY KEY (guild_id, module_id)
);

-- Commands table
CREATE TABLE commands (
    id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'both', -- prefix, slash, both
    cooldown INTEGER DEFAULT 3,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Guild commands (enable/disable per guild)
CREATE TABLE guild_commands (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    command_id INTEGER REFERENCES commands(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    custom_cooldown INTEGER,
    PRIMARY KEY (guild_id, command_id)
);

-- Embeds table
CREATE TABLE embeds (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    color TEXT DEFAULT '#5865F2',
    thumbnail TEXT,
    image TEXT,
    footer_text TEXT,
    footer_icon TEXT,
    fields JSONB DEFAULT '[]',
    buttons JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Placeholders table
CREATE TABLE placeholders (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    description TEXT,
    example TEXT,
    category TEXT DEFAULT 'general'
);

-- Logs configuration
CREATE TABLE guild_logs (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- member_join, member_leave, message_delete, etc.
    enabled BOOLEAN DEFAULT TRUE,
    channel_id TEXT,
    PRIMARY KEY (guild_id, event_type)
);

-- Error logs
CREATE TABLE error_logs (
    id SERIAL PRIMARY KEY,
    guild_id TEXT,
    error_type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Member analytics (30-day retention)
CREATE TABLE member_analytics (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    member_count INTEGER NOT NULL,
    human_count INTEGER NOT NULL,
    bot_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, date)
);

-- Staff activity tracking
CREATE TABLE staff_activity (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    rank TEXT,
    status TEXT DEFAULT 'offline',
    joined_at TIMESTAMP,
    last_active TIMESTAMP,
    is_loa BOOLEAN DEFAULT FALSE,
    loa_reason TEXT,
    loa_until TIMESTAMP
);

-- UwU Lock system
CREATE TABLE uwu_lock (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    added_by TEXT NOT NULL,
    ephemeral BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);

-- Meme module configuration
CREATE TABLE meme_config (
    guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    subreddits JSONB DEFAULT '["memes", "dankmemes"]',
    target_channels JSONB DEFAULT '[]',
    ping_roles JSONB DEFAULT '[]',
    interval_minutes INTEGER DEFAULT 60,
    enabled BOOLEAN DEFAULT FALSE
);

-- Welcome/Leave/Boost messages
CREATE TABLE guild_messages (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL, -- welcome, leave, boost
    enabled BOOLEAN DEFAULT FALSE,
    channel_id TEXT,
    message_content TEXT,
    embed_id INTEGER REFERENCES embeds(id),
    use_card BOOLEAN DEFAULT FALSE,
    card_config JSONB DEFAULT '{}',
    send_dm BOOLEAN DEFAULT FALSE,
    mention_user BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (guild_id, message_type)
);

-- Tickets configuration
CREATE TABLE ticket_panels (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT,
    button_label TEXT DEFAULT 'Create Ticket',
    button_emoji TEXT,
    embed_id INTEGER REFERENCES embeds(id),
    staff_roles JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Active tickets
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    panel_id INTEGER REFERENCES ticket_panels(id),
    channel_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, closed
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

-- Autoresponders
CREATE TABLE autoresponders (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    trigger TEXT NOT NULL,
    response TEXT NOT NULL,
    embed_id INTEGER REFERENCES embeds(id),
    match_type TEXT DEFAULT 'contains', -- exact, contains, starts_with, ends_with
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sticky messages
CREATE TABLE sticky_messages (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id TEXT UNIQUE NOT NULL,
    message_content TEXT,
    embed_id INTEGER REFERENCES embeds(id),
    last_message_id TEXT,
    enabled BOOLEAN DEFAULT TRUE
);

-- Ghost ping detection
CREATE TABLE ghost_pings (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    mentioned_users JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- AFK system
CREATE TABLE afk_users (
    guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    reason TEXT,
    since TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_guild_modules_guild ON guild_modules(guild_id);
CREATE INDEX idx_guild_commands_guild ON guild_commands(guild_id);
CREATE INDEX idx_embeds_guild ON embeds(guild_id);
CREATE INDEX idx_member_analytics_guild_date ON member_analytics(guild_id, date);
CREATE INDEX idx_error_logs_guild ON error_logs(guild_id);
CREATE INDEX idx_staff_activity_guild ON staff_activity(guild_id);

-- Function to auto-delete old analytics (30-day retention)
CREATE OR REPLACE FUNCTION delete_old_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM member_analytics WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guilds_updated_at BEFORE UPDATE ON guilds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_embeds_updated_at BEFORE UPDATE ON embeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
