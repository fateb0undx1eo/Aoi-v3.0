-- Seed Data for Discord Bot System
-- Run this after initial_schema.sql to populate with example data

-- Insert default modules
INSERT INTO modules (name, display_name, description, category, icon, is_premium) VALUES
('moderation', 'Moderation', 'Advanced moderation tools including ghost ping detection and AFK system', 'moderation', '🛡️', false),
('community', 'Community', 'Welcome messages, boost tracking, and member engagement', 'community', '👋', false),
('tickets', 'Tickets', 'Full-featured ticket system with customizable panels', 'support', '🎫', false),
('memes', 'Memes', 'Auto-post memes from Reddit to your channels', 'fun', '😂', false),
('tools', 'Tools', 'Autoresponders, sticky messages, and utilities', 'utility', '🔧', false),
('analytics', 'Analytics', 'Track member trends and server statistics', 'insights', '📊', true);

-- Insert default commands for moderation module
INSERT INTO commands (module_id, name, description, type, cooldown, permissions) VALUES
((SELECT id FROM modules WHERE name = 'moderation'), 'ban', 'Ban a user from the server', 'both', 3, '["BAN_MEMBERS"]'),
((SELECT id FROM modules WHERE name = 'moderation'), 'kick', 'Kick a user from the server', 'both', 3, '["KICK_MEMBERS"]'),
((SELECT id FROM modules WHERE name = 'moderation'), 'timeout', 'Timeout a user', 'both', 3, '["MODERATE_MEMBERS"]'),
((SELECT id FROM modules WHERE name = 'moderation'), 'warn', 'Warn a user', 'both', 3, '["MODERATE_MEMBERS"]'),
((SELECT id FROM modules WHERE name = 'moderation'), 'afk', 'Set your AFK status', 'both', 5, '[]'),
((SELECT id FROM modules WHERE name = 'moderation'), 'loa', 'Request leave of absence', 'both', 60, '[]');

-- Insert default commands for community module
INSERT INTO commands (module_id, name, description, type, cooldown, permissions) VALUES
((SELECT id FROM modules WHERE name = 'community'), 'welcome', 'Configure welcome messages', 'slash', 5, '["MANAGE_GUILD"]'),
((SELECT id FROM modules WHERE name = 'community'), 'leave', 'Configure leave messages', 'slash', 5, '["MANAGE_GUILD"]'),
((SELECT id FROM modules WHERE name = 'community'), 'boost', 'Configure boost messages', 'slash', 5, '["MANAGE_GUILD"]');

-- Insert default commands for tickets module
INSERT INTO commands (module_id, name, description, type, cooldown, permissions) VALUES
((SELECT id FROM modules WHERE name = 'tickets'), 'ticket', 'Manage ticket system', 'slash', 3, '["MANAGE_CHANNELS"]'),
((SELECT id FROM modules WHERE name = 'tickets'), 'close', 'Close a ticket', 'both', 3, '[]'),
((SELECT id FROM modules WHERE name = 'tickets'), 'add', 'Add user to ticket', 'both', 3, '["MANAGE_CHANNELS"]'),
((SELECT id FROM modules WHERE name = 'tickets'), 'remove', 'Remove user from ticket', 'both', 3, '["MANAGE_CHANNELS"]');

-- Insert default commands for memes module
INSERT INTO commands (module_id, name, description, type, cooldown, permissions) VALUES
((SELECT id FROM modules WHERE name = 'memes'), 'meme', 'Get a random meme', 'both', 5, '[]'),
((SELECT id FROM modules WHERE name = 'memes'), 'memeconfig', 'Configure meme auto-posting', 'slash', 10, '["MANAGE_GUILD"]');

-- Insert default commands for tools module
INSERT INTO commands (module_id, name, description, type, cooldown, permissions) VALUES
((SELECT id FROM modules WHERE name = 'tools'), 'embed', 'Create a custom embed', 'slash', 5, '["MANAGE_MESSAGES"]'),
((SELECT id FROM modules WHERE name = 'tools'), 'autoresponder', 'Manage autoresponders', 'slash', 5, '["MANAGE_GUILD"]'),
((SELECT id FROM modules WHERE name = 'tools'), 'sticky', 'Create a sticky message', 'slash', 5, '["MANAGE_MESSAGES"]');

-- Insert default commands for analytics module
INSERT INTO commands (module_id, name, description, type, cooldown, permissions) VALUES
((SELECT id FROM modules WHERE name = 'analytics'), 'stats', 'View server statistics', 'both', 10, '[]'),
((SELECT id FROM modules WHERE name = 'analytics'), 'membertrends', 'View member growth trends', 'slash', 10, '["MANAGE_GUILD"]');

-- Insert default placeholders
INSERT INTO placeholders (key, description, example, category) VALUES
('{user}', 'Username', 'JohnDoe', 'user'),
('{mention}', 'User mention', '@JohnDoe', 'user'),
('{username}', 'Username', 'JohnDoe', 'user'),
('{user_id}', 'User ID', '123456789', 'user'),
('{user_tag}', 'User tag', 'JohnDoe#1234', 'user'),
('{user_avatar}', 'User avatar URL', 'https://cdn.discordapp.com/...', 'user'),
('{created_at}', 'Account creation date', '1/1/2020', 'user'),
('{nickname}', 'Server nickname', 'John', 'member'),
('{joined_at}', 'Server join date', '1/1/2024', 'member'),
('{server_name}', 'Server name', 'My Server', 'guild'),
('{server_id}', 'Server ID', '987654321', 'guild'),
('{server_icon}', 'Server icon URL', 'https://cdn.discordapp.com/...', 'guild'),
('{member_count}', 'Total member count', '1000', 'guild'),
('{boost_level}', 'Server boost level', '2', 'guild'),
('{boost_count}', 'Number of boosts', '14', 'guild'),
('{owner}', 'Server owner mention', '@Owner', 'guild'),
('{channel}', 'Channel mention', '#general', 'channel'),
('{channel_name}', 'Channel name', 'general', 'channel'),
('{channel_id}', 'Channel ID', '111222333', 'channel'),
('{role}', 'Role mention', '@Member', 'role'),
('{role_name}', 'Role name', 'Member', 'role'),
('{role_id}', 'Role ID', '444555666', 'role'),
('{timestamp}', 'Current timestamp', 'Jan 1, 2024 12:00 PM', 'time'),
('{date}', 'Current date', '1/1/2024', 'time'),
('{time}', 'Current time', '12:00:00 PM', 'time');

-- Insert default log event types
-- Note: You'll need to insert these for each guild after guild creation
-- This is just a reference of available event types
-- Event types: member_join, member_leave, member_update, message_delete, message_edit,
-- channel_create, channel_delete, role_create, role_delete, ban_add, ban_remove,
-- emoji_create, emoji_delete, voice_join, voice_leave, boost_add, boost_remove

COMMENT ON TABLE guild_logs IS 'Available event types: member_join, member_leave, member_update, message_delete, message_edit, channel_create, channel_delete, role_create, role_delete, ban_add, ban_remove, emoji_create, emoji_delete, voice_join, voice_leave, boost_add, boost_remove';
