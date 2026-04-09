-- Fix missing updated_at columns

-- Add updated_at to autoresponders
ALTER TABLE autoresponders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add trigger for autoresponders (drop first if exists)
DROP TRIGGER IF EXISTS update_autoresponders_updated_at ON autoresponders;
CREATE TRIGGER update_autoresponders_updated_at 
BEFORE UPDATE ON autoresponders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fix ghost_pings updated_at
ALTER TABLE ghost_pings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
DROP TRIGGER IF EXISTS update_ghost_pings_updated_at ON ghost_pings;
CREATE TRIGGER update_ghost_pings_updated_at 
BEFORE UPDATE ON ghost_pings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fix afk_users - rename since_at to updated_at for consistency
ALTER TABLE afk_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Fix tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at 
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fix meme_config
ALTER TABLE meme_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
DROP TRIGGER IF EXISTS update_meme_config_updated_at ON meme_config;
CREATE TRIGGER update_meme_config_updated_at 
BEFORE UPDATE ON meme_config
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fix guild_messages
ALTER TABLE guild_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
DROP TRIGGER IF EXISTS update_guild_messages_updated_at ON guild_messages;
CREATE TRIGGER update_guild_messages_updated_at 
BEFORE UPDATE ON guild_messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
