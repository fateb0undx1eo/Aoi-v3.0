-- Final Tickets Migration - Handles Schema Migration from Old to New
-- This migration safely migrates from the old tickets table to the new enhanced schema

-- Step 1: Create the new enhanced tickets table structure
CREATE TABLE IF NOT EXISTS tickets_new (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    thread_id TEXT UNIQUE NOT NULL,
    creator_id TEXT NOT NULL, -- Renamed from user_id
    tag TEXT NOT NULL, -- Ticket category/tag (general_support, report_user, etc.)
    tag_label TEXT NOT NULL, -- Human-readable tag label
    welcome_message_id TEXT, -- ID of the welcome message in the thread
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT, -- User ID of staff who resolved the ticket
    log_message_id TEXT, -- ID of the "Created" log message
    resolved_log_message_id TEXT, -- ID of the "Resolved" log message
    thread_name TEXT, -- Original thread name without [CLOSED] prefix
    is_archived BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    auto_archive_duration INTEGER DEFAULT 1440, -- Discord auto-archive duration in minutes
    
    -- Indexes for efficient lookups
    CONSTRAINT tickets_new_thread_id_unique UNIQUE (thread_id),
    CONSTRAINT tickets_new_guild_user_open_unique UNIQUE (guild_id, creator_id) 
        DEFERRABLE INITIALLY DEFERRED -- Allow temporary duplicates during creation
);

-- Step 2: Create indexes for the new table
CREATE INDEX IF NOT EXISTS idx_tickets_new_guild_id ON tickets_new(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_new_creator_id ON tickets_new(creator_id);
CREATE INDEX IF NOT EXISTS idx_tickets_new_status ON tickets_new(status);
CREATE INDEX IF NOT EXISTS idx_tickets_new_guild_creator_status ON tickets_new(guild_id, creator_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_new_thread_id ON tickets_new(thread_id);
CREATE INDEX IF NOT EXISTS idx_tickets_new_created_at ON tickets_new(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_new_resolved_at ON tickets_new(resolved_at) WHERE resolved_at IS NOT NULL;

-- Step 3: Migrate data from old table to new table (if old table exists)
DO $$
BEGIN
    -- Check if old tickets table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets' AND table_schema = 'public') THEN
        -- Migrate existing data
        INSERT INTO tickets_new (guild_id, thread_id, creator_id, status, created_at, resolved_at)
        SELECT 
            guild_id,
            channel_id as thread_id, -- Map old channel_id to new thread_id
            user_id as creator_id, -- Map old user_id to new creator_id
            CASE 
                WHEN status = 'closed' THEN 'resolved'
                ELSE status
            END as status,
            created_at,
            closed_at as resolved_at
        FROM tickets
        ON CONFLICT (thread_id) DO NOTHING; -- Avoid duplicates
        
        RAISE NOTICE 'Migrated existing tickets data to new schema';
    END IF;
END $$;

-- Step 4: Create ticket cooldowns table if it doesn't exist
CREATE TABLE IF NOT EXISTS ticket_cooldowns (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cooldown_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);

-- Create index for cooldown cleanup
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_until ON ticket_cooldowns(cooldown_until);

-- Step 5: Create functions and triggers for the new table
-- Function to clean up expired cooldowns
CREATE OR REPLACE FUNCTION cleanup_expired_cooldowns()
RETURNS void AS $$
BEGIN
    DELETE FROM ticket_cooldowns 
    WHERE cooldown_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to safely create unique ticket constraints
CREATE OR REPLACE FUNCTION enforce_unique_open_tickets()
RETURNS trigger AS $$
BEGIN
    -- Check if user already has an open ticket in this guild
    IF EXISTS (
        SELECT 1 FROM tickets_new 
        WHERE guild_id = NEW.guild_id 
        AND creator_id = NEW.creator_id 
        AND status = 'open'
        AND thread_id != NEW.thread_id
    ) THEN
        RAISE EXCEPTION 'User already has an open ticket in this guild';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce unique open tickets
DROP TRIGGER IF EXISTS enforce_unique_open_tickets_trigger ON tickets_new;
CREATE TRIGGER enforce_unique_open_tickets_trigger
    BEFORE INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION enforce_unique_open_tickets();

-- Function to update ticket status and timestamps
CREATE OR REPLACE FUNCTION update_ticket_status()
RETURNS trigger AS $$
BEGIN
    -- Auto-update timestamps based on status
    IF OLD.status != NEW.status THEN
        CASE NEW.status
            WHEN 'resolved' THEN
                NEW.resolved_at = NOW();
                NEW.is_locked = TRUE;
                NEW.is_archived = TRUE;
            WHEN 'open' THEN
                NEW.resolved_at = NULL;
                NEW.resolved_by = NULL;
                NEW.is_locked = FALSE;
                NEW.is_archived = FALSE;
            WHEN 'archived' THEN
                NEW.is_archived = TRUE;
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update status-related fields
DROP TRIGGER IF EXISTS update_ticket_status_trigger ON tickets_new;
CREATE TRIGGER update_ticket_status_trigger
    BEFORE UPDATE ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_status();

-- Step 6: Create view for active tickets
DROP VIEW IF EXISTS active_tickets;
CREATE VIEW active_tickets AS
SELECT 
    id,
    guild_id,
    thread_id,
    creator_id,
    tag,
    tag_label,
    status,
    created_at,
    resolved_at,
    resolved_by,
    thread_name,
    CASE 
        WHEN status = 'open' THEN true
        WHEN status = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours' THEN true
        ELSE false
    END as is_active
FROM tickets_new
WHERE status = 'open' 
   OR (status = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours');

-- Step 7: Atomic table swap
DO $$
BEGIN
    -- Drop old table if it exists
    DROP TABLE IF EXISTS tickets CASCADE;
    
    -- Rename new table to final name
    ALTER TABLE tickets_new RENAME TO tickets;
    
    -- Rename constraints to remove "_new" suffix
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_new_thread_id_unique;
    ALTER TABLE tickets ADD CONSTRAINT tickets_thread_id_unique UNIQUE (thread_id);
    
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_new_guild_user_open_unique;
    ALTER TABLE tickets ADD CONSTRAINT tickets_guild_user_open_unique UNIQUE (guild_id, creator_id) 
        DEFERRABLE INITIALLY DEFERRED;
    
    RAISE NOTICE 'Successfully migrated to new tickets schema';
END $$;

-- Step 8: Add comments for documentation
COMMENT ON TABLE tickets IS 'Enhanced tickets table with comprehensive metadata to eliminate Discord API message scanning';
COMMENT ON COLUMN tickets.thread_id IS 'Discord thread ID - unique identifier';
COMMENT ON COLUMN tickets.creator_id IS 'Discord user ID who created the ticket';
COMMENT ON COLUMN tickets.tag IS 'Internal ticket category value';
COMMENT ON COLUMN tickets.tag_label IS 'Human-readable ticket category label';
COMMENT ON COLUMN tickets.welcome_message_id IS 'Discord message ID of the welcome message in thread';
COMMENT ON COLUMN tickets.log_message_id IS 'Discord message ID of the "Created" log entry';
COMMENT ON COLUMN tickets.resolved_log_message_id IS 'Discord message ID of the "Resolved" log entry';
COMMENT ON COLUMN tickets.thread_name IS 'Original thread name without [CLOSED] prefix';
COMMENT ON COLUMN tickets.is_archived IS 'Mirror of Discord thread archived status';
COMMENT ON COLUMN tickets.is_locked IS 'Mirror of Discord thread locked status';
COMMENT ON COLUMN tickets.auto_archive_duration IS 'Discord auto-archive duration in minutes';

COMMENT ON TABLE ticket_cooldowns IS 'Distributed cooldown management for ticket creation';
COMMENT ON COLUMN ticket_cooldowns.cooldown_until IS 'Timestamp when cooldown expires';

COMMENT ON VIEW active_tickets IS 'View of currently active tickets (open or recently resolved)';

-- Step 9: Migration metadata
CREATE TABLE IF NOT EXISTS migration_metadata (
    migration_name TEXT PRIMARY KEY,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version TEXT DEFAULT '1.0.0'
);

-- Mark this migration as completed
INSERT INTO migration_metadata (migration_name, version) 
VALUES ('20260511_tickets_migration_final', '1.0.0')
ON CONFLICT (migration_name) DO UPDATE SET 
    completed_at = NOW(),
    version = EXCLUDED.version;

DO $$
BEGIN
    RAISE NOTICE 'Tickets migration completed successfully';
END $$;
