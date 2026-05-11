-- Final Tickets Migration - Handles Schema Migration from Old to New
-- This migration safely migrates from the old tickets table to the new enhanced schema

-- Step 1: Create sequences for ticket numbering
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create guild-specific ticket number sequences
CREATE SEQUENCE IF NOT EXISTS guild_ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 10;

-- Step 2: Create the new enhanced tickets table structure
CREATE TABLE IF NOT EXISTS tickets_new (
    id SERIAL PRIMARY KEY,
    ticket_number INTEGER NOT NULL DEFAULT nextval('ticket_number_seq'),
    guild_ticket_number INTEGER NOT NULL DEFAULT nextval('guild_ticket_number_seq'),
    guild_id TEXT NOT NULL,
    thread_id TEXT UNIQUE NOT NULL,
    creator_id TEXT NOT NULL, -- Renamed from user_id
    tag TEXT NOT NULL, -- Ticket category/tag (general_support, report_user, etc.)
    tag_label TEXT NOT NULL, -- Human-readable tag label
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to TEXT, -- Staff member assigned to ticket
    welcome_message_id TEXT, -- ID of the welcome message in the thread
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed', 'orphaned')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT, -- User ID of staff who resolved the ticket
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopened_by TEXT, -- User ID who reopened the ticket
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by TEXT, -- User ID who closed the ticket
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalated_by TEXT, -- User ID who escalated the ticket
    escalation_level INTEGER DEFAULT 1 CHECK (escalation_level BETWEEN 1 AND 3),
    log_message_id TEXT, -- ID of the "Created" log message
    resolved_log_message_id TEXT, -- ID of the "Resolved" log message
    thread_name TEXT, -- Original thread name without [CLOSED] prefix
    original_thread_name TEXT, -- Keep track of original name before modifications
    is_archived BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    auto_archive_duration INTEGER DEFAULT 1440, -- Discord auto-archive duration in minutes
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolution_reason TEXT, -- Reason for resolution
    internal_notes TEXT, -- Staff internal notes
    metadata JSONB DEFAULT '{}', -- Additional flexible metadata
    
    -- Enhanced constraints for enterprise architecture
    CONSTRAINT tickets_new_thread_id_unique UNIQUE (thread_id),
    CONSTRAINT tickets_new_guild_user_open_unique UNIQUE (guild_id, creator_id) 
        DEFERRABLE INITIALLY DEFERRED, -- Allow temporary duplicates during creation
    CONSTRAINT tickets_new_guild_ticket_number_unique UNIQUE (guild_id, guild_ticket_number),
    CONSTRAINT tickets_new_ticket_number_unique UNIQUE (ticket_number),
    CONSTRAINT tickets_new_valid_status CHECK (
        status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed', 'orphaned')
    ),
    CONSTRAINT tickets_new_valid_resolution CHECK (
        (status != 'resolved') OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
    ),
    CONSTRAINT tickets_new_valid_assignment CHECK (
        assigned_to IS NULL OR assigned_to ~ '^\d{17,19}$' -- Valid Discord user ID format
    )
);

-- Step 3: Create comprehensive indexes for enterprise performance
CREATE INDEX IF NOT EXISTS idx_tickets_new_guild_id ON tickets_new(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_new_creator_id ON tickets_new(creator_id);
CREATE INDEX IF NOT EXISTS idx_tickets_new_status ON tickets_new(status);
CREATE INDEX IF NOT EXISTS idx_tickets_new_priority ON tickets_new(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_new_tag ON tickets_new(tag);
CREATE INDEX IF NOT EXISTS idx_tickets_new_assigned_to ON tickets_new(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_new_guild_creator_status ON tickets_new(guild_id, creator_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_new_guild_status_priority ON tickets_new(guild_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_new_thread_id ON tickets_new(thread_id);
CREATE INDEX IF NOT EXISTS idx_tickets_new_ticket_number ON tickets_new(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_new_guild_ticket_number ON tickets_new(guild_id, guild_ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_new_created_at ON tickets_new(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_new_updated_at ON tickets_new(updated_at);
CREATE INDEX IF NOT EXISTS idx_tickets_new_last_activity_at ON tickets_new(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_tickets_new_resolved_at ON tickets_new(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_new_resolved_by ON tickets_new(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_new_escalation_level ON tickets_new(escalation_level) WHERE escalation_level > 1;

-- JSONB indexes for metadata queries
CREATE INDEX IF NOT EXISTS idx_tickets_new_metadata_gin ON tickets_new USING gin(metadata);

-- Partial indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tickets_new_open_tickets ON tickets_new(guild_id, created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_tickets_new_unassigned ON tickets_new(guild_id, created_at) WHERE status = 'open' AND assigned_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_new_high_priority ON tickets_new(guild_id, created_at) WHERE priority IN ('high', 'urgent') AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_tickets_new_escalated ON tickets_new(guild_id, escalated_at) WHERE escalation_level > 1;

-- Step 4: Migrate data from old table to new table (if old table exists)
DO $$
BEGIN
    -- Check if old tickets table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets' AND table_schema = 'public') THEN
        -- Migrate existing data with new enterprise fields
        INSERT INTO tickets_new (
            guild_id, thread_id, creator_id, tag, tag_label, status, 
            created_at, updated_at, resolved_at, resolved_by,
            thread_name, original_thread_name, is_archived, is_locked,
            auto_archive_duration, last_activity_at, priority
        )
        SELECT 
            guild_id,
            channel_id as thread_id, -- Map old channel_id to new thread_id
            user_id as creator_id, -- Map old user_id to new creator_id
            COALESCE(tag, 'general_support') as tag, -- Default tag if missing
            COALESCE(tag_label, 'General Support') as tag_label, -- Default label
            CASE 
                WHEN status = 'closed' THEN 'resolved'
                WHEN status = 'archived' THEN 'closed'
                ELSE COALESCE(status, 'open')
            END as status,
            created_at,
            COALESCE(updated_at, created_at) as updated_at,
            closed_at as resolved_at,
            NULL as resolved_by, -- Will be populated later if needed
            thread_name,
            thread_name as original_thread_name,
            COALESCE(is_archived, FALSE) as is_archived,
            COALESCE(is_locked, FALSE) as is_locked,
            COALESCE(auto_archive_duration, 1440) as auto_archive_duration,
            COALESCE(last_activity_at, created_at) as last_activity_at,
            COALESCE(priority, 'normal') as priority
        FROM tickets
        ON CONFLICT (thread_id) DO NOTHING; -- Avoid duplicates
        
        RAISE NOTICE 'Migrated existing tickets data to new enterprise schema';
    END IF;
END $$;

-- Step 5: Create enhanced ticket cooldowns table with enterprise features
CREATE TABLE IF NOT EXISTS ticket_cooldowns (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cooldown_type TEXT DEFAULT 'ticket_creation' CHECK (cooldown_type IN ('ticket_creation', 'user_management', 'escalation')),
    cooldown_until TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms INTEGER NOT NULL, -- Store original duration for metrics
    reason TEXT, -- Reason for cooldown
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT, -- Staff member who created the cooldown
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    
    -- Enterprise constraints
    CONSTRAINT ticket_cooldowns_guild_user_type_unique UNIQUE (guild_id, user_id, cooldown_type),
    CONSTRAINT ticket_cooldowns_valid_duration CHECK (duration_ms > 0),
    CONSTRAINT ticket_cooldowns_valid_user_id CHECK (user_id ~ '^\d{17,19}$'),
    CONSTRAINT ticket_cooldowns_valid_creator CHECK (created_by IS NULL OR created_by ~ '^\d{17,19}$')
);

-- Create indexes for cooldown performance
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_guild_id ON ticket_cooldowns(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_user_id ON ticket_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_type ON ticket_cooldowns(cooldown_type);
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_until ON ticket_cooldowns(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_active ON ticket_cooldowns(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_created_at ON ticket_cooldowns(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_cooldowns_guild_user_active ON ticket_cooldowns(guild_id, user_id, is_active) WHERE is_active = TRUE;

-- Step 6: Create enterprise-grade functions and triggers for the new table

-- Enhanced function to clean up expired cooldowns
CREATE OR REPLACE FUNCTION cleanup_expired_cooldowns()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ticket_cooldowns 
    WHERE cooldown_until < NOW() OR is_active = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update ticket timestamps automatically
CREATE OR REPLACE FUNCTION update_ticket_timestamps()
RETURNS trigger AS $$
BEGIN
    -- Always update updated_at and last_activity_at
    NEW.updated_at = NOW();
    NEW.last_activity_at = NOW();
    
    -- Auto-update timestamps based on status changes
    IF OLD.status != NEW.status THEN
        CASE NEW.status
            WHEN 'resolved' THEN
                NEW.resolved_at = NOW();
                NEW.is_locked = TRUE;
                NEW.is_archived = TRUE;
            WHEN 'closed' THEN
                NEW.closed_at = NOW();
                NEW.is_locked = TRUE;
                NEW.is_archived = TRUE;
            WHEN 'open' THEN
                -- Clear resolution/close timestamps when reopening
                NEW.resolved_at = NULL;
                NEW.resolved_by = NULL;
                NEW.closed_at = NULL;
                NEW.closed_by = NULL;
                NEW.is_locked = FALSE;
                NEW.is_archived = FALSE;
                NEW.reopened_at = NOW();
            WHEN 'in_progress' THEN
                NEW.assigned_to = COALESCE(NEW.assigned_to, NEW.resolved_by);
            WHEN 'escalated' THEN
                NEW.escalated_at = NOW();
                NEW.escalation_level = COALESCE(NEW.escalation_level, 1) + 1;
        END CASE;
    END IF;
    
    -- Update escalation timestamps
    IF OLD.escalation_level != NEW.escalation_level AND NEW.escalation_level > OLD.escalation_level THEN
        NEW.escalated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce unique open tickets with guild-specific numbering
CREATE OR REPLACE FUNCTION enforce_unique_open_tickets()
RETURNS trigger AS $$
DECLARE
    existing_ticket RECORD;
    next_guild_number INTEGER;
BEGIN
    -- Check if user already has an open ticket in this guild
    SELECT id INTO existing_ticket
    FROM tickets_new 
    WHERE guild_id = NEW.guild_id 
    AND creator_id = NEW.creator_id 
    AND status = 'open'
    AND thread_id != NEW.thread_id
    LIMIT 1;
    
    IF existing_ticket IS NOT NULL THEN
        RAISE EXCEPTION 'User % already has an open ticket (#%) in this guild', 
            NEW.creator_id, existing_ticket.id;
    END IF;
    
    -- Set guild-specific ticket number if not provided
    IF NEW.guild_ticket_number IS NULL THEN
        SELECT COALESCE(MAX(guild_ticket_number), 0) + 1 
        INTO next_guild_number
        FROM tickets_new 
        WHERE guild_id = NEW.guild_id;
        
        NEW.guild_ticket_number = next_guild_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate Discord user IDs
CREATE OR REPLACE FUNCTION validate_discord_user_id()
RETURNS trigger AS $$
BEGIN
    -- Validate creator_id
    IF NEW.creator_id IS NOT NULL AND NEW.creator_id !~ '^\d{17,19}$' THEN
        RAISE EXCEPTION 'Invalid creator_id format: %', NEW.creator_id;
    END IF;
    
    -- Validate assigned_to
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to !~ '^\d{17,19}$' THEN
        RAISE EXCEPTION 'Invalid assigned_to format: %', NEW.assigned_to;
    END IF;
    
    -- Validate resolved_by
    IF NEW.resolved_by IS NOT NULL AND NEW.resolved_by !~ '^\d{17,19}$' THEN
        RAISE EXCEPTION 'Invalid resolved_by format: %', NEW.resolved_by;
    END IF;
    
    -- Validate other user ID fields
    IF NEW.reopened_by IS NOT NULL AND NEW.reopened_by !~ '^\d{17,19}$' THEN
        RAISE EXCEPTION 'Invalid reopened_by format: %', NEW.reopened_by;
    END IF;
    
    IF NEW.closed_by IS NOT NULL AND NEW.closed_by !~ '^\d{17,19}$' THEN
        RAISE EXCEPTION 'Invalid closed_by format: %', NEW.closed_by;
    END IF;
    
    IF NEW.escalated_by IS NOT NULL AND NEW.escalated_by !~ '^\d{17,19}$' THEN
        RAISE EXCEPTION 'Invalid escalated_by format: %', NEW.escalated_by;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create enterprise-grade triggers for the new table

-- Trigger to enforce unique open tickets with guild numbering
DROP TRIGGER IF EXISTS enforce_unique_open_tickets_trigger ON tickets_new;
CREATE TRIGGER enforce_unique_open_tickets_trigger
    BEFORE INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION enforce_unique_open_tickets();

-- Trigger to auto-update timestamps and status-related fields
DROP TRIGGER IF EXISTS update_ticket_timestamps_trigger ON tickets_new;
CREATE TRIGGER update_ticket_timestamps_trigger
    BEFORE UPDATE ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_timestamps();

-- Trigger to validate Discord user IDs
DROP TRIGGER IF EXISTS validate_discord_user_id_trigger ON tickets_new;
CREATE TRIGGER validate_discord_user_id_trigger
    BEFORE INSERT OR UPDATE ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION validate_discord_user_id();

-- Trigger for cooldowns table to update timestamps
CREATE OR REPLACE FUNCTION update_cooldown_timestamps()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cooldown_timestamps_trigger ON ticket_cooldowns;
CREATE TRIGGER update_cooldown_timestamps_trigger
    BEFORE UPDATE ON ticket_cooldowns
    FOR EACH ROW
    EXECUTE FUNCTION update_cooldown_timestamps();

-- Step 8: Create enterprise views for reporting and analytics

-- Enhanced view for active tickets with more metadata
DROP VIEW IF EXISTS active_tickets;
CREATE VIEW active_tickets AS
SELECT 
    id,
    ticket_number,
    guild_ticket_number,
    guild_id,
    thread_id,
    creator_id,
    tag,
    tag_label,
    priority,
    assigned_to,
    status,
    created_at,
    updated_at,
    resolved_at,
    resolved_by,
    last_activity_at,
    escalation_level,
    thread_name,
    CASE 
        WHEN status = 'open' THEN true
        WHEN status = 'in_progress' THEN true
        WHEN status = 'waiting_response' THEN true
        WHEN status = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours' THEN true
        ELSE false
    END as is_active,
    CASE 
        WHEN status = 'open' AND assigned_to IS NULL THEN 'unassigned'
        WHEN status = 'open' AND assigned_to IS NOT NULL THEN 'assigned'
        WHEN status = 'in_progress' THEN 'in_progress'
        WHEN status = 'waiting_response' THEN 'waiting_response'
        WHEN status = 'resolved' THEN 'resolved'
        ELSE 'other'
    END as activity_state,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as age_minutes,
    EXTRACT(EPOCH FROM (NOW() - last_activity_at)) / 60 as last_activity_minutes
FROM tickets_new
WHERE status IN ('open', 'in_progress', 'waiting_response') 
   OR (status = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours');

-- View for ticket statistics and metrics
DROP VIEW IF EXISTS ticket_statistics;
CREATE VIEW ticket_statistics AS
SELECT 
    guild_id,
    COUNT(*) as total_tickets,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
    COUNT(CASE WHEN status = 'waiting_response' THEN 1 END) as waiting_response_tickets,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
    COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
    COUNT(CASE WHEN assigned_to IS NULL AND status = 'open' THEN 1 END) as unassigned_tickets,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_tickets,
    COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tickets,
    COUNT(CASE WHEN escalation_level > 1 THEN 1 END) as escalated_tickets,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 60) as avg_resolution_minutes,
    MIN(created_at) as oldest_ticket,
    MAX(created_at) as newest_ticket
FROM tickets_new
GROUP BY guild_id;

-- View for staff performance metrics
DROP VIEW IF EXISTS staff_performance;
CREATE VIEW staff_performance AS
SELECT 
    guild_id,
    assigned_to as staff_id,
    COUNT(*) as tickets_assigned,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as tickets_resolved,
    COUNT(CASE WHEN status = 'resolved' AND resolved_by = assigned_to THEN 1 END) as tickets_self_resolved,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 60) as avg_resolution_minutes,
    MIN(created_at) as first_assignment,
    MAX(created_at) as last_assignment
FROM tickets_new
WHERE assigned_to IS NOT NULL
GROUP BY guild_id, assigned_to;

-- Step 9: Atomic table swap with enterprise constraints
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
    
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_new_guild_ticket_number_unique;
    ALTER TABLE tickets ADD CONSTRAINT tickets_guild_ticket_number_unique UNIQUE (guild_id, guild_ticket_number);
    
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_new_ticket_number_unique;
    ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_number_unique UNIQUE (ticket_number);
    
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_new_valid_status;
    ALTER TABLE tickets ADD CONSTRAINT tickets_valid_status CHECK (
        status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed', 'orphaned')
    );
    
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_new_valid_resolution;
    ALTER TABLE tickets ADD CONSTRAINT tickets_valid_resolution CHECK (
        (status != 'resolved') OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
    );
    
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_new_valid_assignment;
    ALTER TABLE tickets ADD CONSTRAINT tickets_valid_assignment CHECK (
        assigned_to IS NULL OR assigned_to ~ '^\d{17,19}$'
    );
    
    RAISE NOTICE 'Successfully migrated to new enterprise tickets schema';
END $$;

-- Step 10: Add comprehensive comments for enterprise documentation
COMMENT ON TABLE tickets IS 'Enterprise-grade tickets table with comprehensive metadata to eliminate Discord API message scanning and support horizontal scalability';
COMMENT ON COLUMN tickets.ticket_number IS 'Global sequential ticket number across all guilds';
COMMENT ON COLUMN tickets.guild_ticket_number IS 'Guild-specific sequential ticket number';
COMMENT ON COLUMN tickets.thread_id IS 'Discord thread ID - unique identifier';
COMMENT ON COLUMN tickets.creator_id IS 'Discord user ID who created the ticket';
COMMENT ON COLUMN tickets.tag IS 'Internal ticket category value (general_support, report_user, etc.)';
COMMENT ON COLUMN tickets.tag_label IS 'Human-readable ticket category label';
COMMENT ON COLUMN tickets.priority IS 'Ticket priority level (low, normal, high, urgent)';
COMMENT ON COLUMN tickets.assigned_to IS 'Discord user ID of assigned staff member';
COMMENT ON COLUMN tickets.welcome_message_id IS 'Discord message ID of the welcome message in thread';
COMMENT ON COLUMN tickets.status IS 'Ticket status (open, in_progress, waiting_response, resolved, closed, orphaned)';
COMMENT ON COLUMN tickets.created_at IS 'Timestamp when ticket was created';
COMMENT ON COLUMN tickets.updated_at IS 'Timestamp when ticket was last updated';
COMMENT ON COLUMN tickets.resolved_at IS 'Timestamp when ticket was resolved';
COMMENT ON COLUMN tickets.resolved_by IS 'Discord user ID of staff who resolved the ticket';
COMMENT ON COLUMN tickets.reopened_at IS 'Timestamp when ticket was reopened';
COMMENT ON COLUMN tickets.reopened_by IS 'Discord user ID who reopened the ticket';
COMMENT ON COLUMN tickets.closed_at IS 'Timestamp when ticket was closed';
COMMENT ON COLUMN tickets.closed_by IS 'Discord user ID who closed the ticket';
COMMENT ON COLUMN tickets.escalated_at IS 'Timestamp when ticket was escalated';
COMMENT ON COLUMN tickets.escalated_by IS 'Discord user ID who escalated the ticket';
COMMENT ON COLUMN tickets.escalation_level IS 'Current escalation level (1-3)';
COMMENT ON COLUMN tickets.log_message_id IS 'Discord message ID of the "Created" log entry';
COMMENT ON COLUMN tickets.resolved_log_message_id IS 'Discord message ID of the "Resolved" log message';
COMMENT ON COLUMN tickets.thread_name IS 'Current thread name';
COMMENT ON COLUMN tickets.original_thread_name IS 'Original thread name before modifications';
COMMENT ON COLUMN tickets.is_archived IS 'Mirror of Discord thread archived status';
COMMENT ON COLUMN tickets.is_locked IS 'Mirror of Discord thread locked status';
COMMENT ON COLUMN tickets.auto_archive_duration IS 'Discord auto-archive duration in minutes';
COMMENT ON COLUMN tickets.last_activity_at IS 'Timestamp of last activity in ticket';
COMMENT ON COLUMN tickets.resolution_reason IS 'Reason for ticket resolution';
COMMENT ON COLUMN tickets.internal_notes IS 'Staff internal notes';
COMMENT ON COLUMN tickets.metadata IS 'Additional flexible metadata in JSONB format';

COMMENT ON TABLE ticket_cooldowns IS 'Enterprise cooldown management with multiple cooldown types and comprehensive tracking';
COMMENT ON COLUMN ticket_cooldowns.id IS 'Primary key for cooldown records';
COMMENT ON COLUMN ticket_cooldowns.guild_id IS 'Discord guild ID';
COMMENT ON COLUMN ticket_cooldowns.user_id IS 'Discord user ID';
COMMENT ON COLUMN ticket_cooldowns.cooldown_type IS 'Type of cooldown (ticket_creation, user_management, escalation)';
COMMENT ON COLUMN ticket_cooldowns.cooldown_until IS 'Timestamp when cooldown expires';
COMMENT ON COLUMN ticket_cooldowns.duration_ms IS 'Original cooldown duration in milliseconds';
COMMENT ON COLUMN ticket_cooldowns.reason IS 'Reason for cooldown';
COMMENT ON COLUMN ticket_cooldowns.created_at IS 'Timestamp when cooldown was created';
COMMENT ON COLUMN ticket_cooldowns.updated_at IS 'Timestamp when cooldown was last updated';
COMMENT ON COLUMN ticket_cooldowns.created_by IS 'Discord user ID of staff who created the cooldown';
COMMENT ON COLUMN ticket_cooldowns.is_active IS 'Whether cooldown is currently active';
COMMENT ON COLUMN ticket_cooldowns.metadata IS 'Additional cooldown metadata in JSONB format';

COMMENT ON VIEW active_tickets IS 'Enterprise view of currently active tickets with comprehensive metadata and activity states';
COMMENT ON VIEW ticket_statistics IS 'Guild-level ticket statistics and performance metrics for reporting';
COMMENT ON VIEW staff_performance IS 'Staff performance metrics including resolution times and ticket handling statistics';

-- Step 11: Final migration metadata and completion
CREATE TABLE IF NOT EXISTS migration_metadata (
    migration_name TEXT PRIMARY KEY,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version TEXT DEFAULT '2.0.0',
    description TEXT
);

-- Mark this enterprise migration as completed
INSERT INTO migration_metadata (migration_name, version, description) 
VALUES ('20260511_tickets_migration_final', '2.0.0', 'Enterprise-grade ticket system with sequences, constraints, triggers, and comprehensive metadata')
ON CONFLICT (migration_name) DO UPDATE SET 
    completed_at = NOW(),
    version = EXCLUDED.version,
    description = EXCLUDED.description;

-- Create index for migration metadata
CREATE INDEX IF NOT EXISTS idx_migration_metadata_completed_at ON migration_metadata(completed_at);

DO $$
BEGIN
    RAISE NOTICE 'Enterprise tickets migration completed successfully';
    RAISE NOTICE 'New features added: sequences, constraints, triggers, views, comprehensive metadata';
    RAISE NOTICE 'Database is now ready for enterprise-grade ticket system';
END $$;
