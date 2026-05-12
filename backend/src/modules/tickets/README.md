# 🎫 Tickets Module - Enterprise Architecture

## Overview

This is a fully refactored tickets module implementing enterprise-grade patterns for Discord ticket management. The module is completely modular, uses Redis for distributed state management, and PostgreSQL for persistent data storage.

## Architecture Overview

```
tickets/
├── index.js                          # Module entry point & initialization
├── commands/
│   └── ticket-command.js             # Slash commands: /ticket panel, /ticket manage users
├── components/                       # Discord UI component builders
│   ├── buttons.js                    # Button component builders
│   ├── modals.js                     # Modal component builders
│   ├── payloads.js                   # Complete message payload builders
│   └── selects.js                    # Select menu builders
├── handlers/                         # Business logic handlers
│   ├── interaction-router.js         # Main interaction dispatcher
│   ├── ticket-creation.js            # Ticket creation workflow
│   ├── ticket-resolution.js          # Ticket closure workflow
│   └── user-management.js            # Add/remove users from tickets
├── repositories/                     # Data access layer
│   ├── ticket-repository.js          # Ticket data operations
│   └── cooldown-repository.js        # Cooldown state in Redis
├── services/                         # Business logic & coordination
│   ├── cooldown-service.js           # Cooldown management
│   ├── lock-service.js               # Distributed locking
│   ├── webhook-service.js            # Discord webhook management
│   ├── logging-service.js            # Structured logging
│   ├── metrics-service.js            # Performance metrics
│   ├── discord-rest-service.js       # Discord API with retry logic
│   ├── ticket-service.js             # High-level ticket operations
│   ├── reconciliation-service.js     # Discord state sync
│   ├── cleanup-service.js            # Maintenance operations
│   └── production-service.js         # Production optimizations
├── jobs/                             # Background jobs
│   ├── cooldown-cleanup-job.js       # Periodic cooldown cleanup
│   └── reconciliation-job.js         # Discord state reconciliation
├── utils/                            # Utilities
│   ├── constants.js                  # Centralized constants
│   ├── custom-id-utils.js            # Custom ID parsing/building
│   ├── validators.js                 # Input validation
│   ├── permissions.js                # Permission checking
│   ├── thread-utils.js               # Discord thread utilities
│   ├── error-handler.js              # Error handling
│   └── redis-keys.js                 # Redis key management
└── tests/
    └── ticket-system-test.js         # Integration tests

```

## Key Features

### 🔐 Distributed State Management
- **Redis**: Cooldowns, creation locks, webhook cache, metrics
- **PostgreSQL**: Persistent ticket records, action history
- **Atomic operations**: Lua scripts for compare-and-swap

### 📊 Data Flow Architecture

```
Discord Interaction
    ↓
interactionRouter
    ↓
Handler (Creation/Resolution/UserMgmt)
    ↓
Service Layer (Cooldown, Lock, Ticket)
    ↓
Repository Layer (Database/Redis)
    ↓
Data Store (PostgreSQL/Redis)
```

### 🛡️ Permission Model
- **Ticket Staff**: Users with staff role or admin permissions
- **Admin/Owner Only**: Panel creation (/ticket panel)
- **Creator Only**: Can press RESOLVED button (creator's own ticket)

### 🔄 Workflows

#### 1. Ticket Creation
1. User selects tag from panel
2. Check: Cooldown status
3. Check: Existing open tickets
4. Create private thread
5. Add creator to thread
6. Send welcome message with RESOLVED button
7. Add staff members (configurable)
8. Record in database

#### 2. Ticket Resolution
1. Staff presses RESOLVED button
2. Show confirmation prompt (Yes/No)
3. On confirm:
   - Disable RESOLVED button
   - Remove creator from thread
   - Lock and archive thread
   - Apply cooldown
   - Update database
4. On cancel: Do nothing

#### 3. User Management
1. Staff uses `/ticket manage users`
2. Shows Add/Remove buttons
3. On button click: Show modal with user selector
4. Add/Remove user from thread
5. Record action in database

### 🚀 Usage

```javascript
import initializeTicketsModule from './modules/tickets/index.js';

// Initialize module
const ticketsModule = await initializeTicketsModule({
  database: postgresClient,
  redis: redisClient,
  discordClient: discordBotClient,
  environment: 'production'
});

// Add to bot
bot.on('interactionCreate', async (interaction) => {
  // Module handles it automatically via events
});

// Shutdown cleanup
await ticketsModule.shutdown();
```

### 📦 Service Access

```javascript
// Access services from module
const { services, repositories, handlers } = ticketsModule;

// Cooldown management
const status = await services.cooldown.getCooldownStatus(userId);
await services.cooldown.applyCooldown(userId);

// Metrics
const metrics = await services.metrics.getMetricsSnapshot();

// Ticket queries
const tickets = await repositories.ticket.getActiveTicketsForUser(guildId, userId);
```

### 🔧 Configuration

Key constants in `utils/constants.js`:
- `TICKET_STAFF_ROLE_IDS`: Roles that can manage tickets
- `TICKET_LOG_CHANNEL_ID`: Where to log ticket events
- `AUTO_ARCHIVE_24H`: Thread archive timeout
- `TICKET_COOLDOWN_MS`: Cooldown after ticket close
- `TICKET_TAGS`: Available ticket categories

### 📊 Database Schema

The module expects these tables:

```sql
-- Tickets table
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  thread_id TEXT NOT NULL UNIQUE,
  creator_id TEXT NOT NULL,
  tag_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

-- User actions table
CREATE TABLE ticket_user_actions (
  id SERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  action_type TEXT,
  target_user_id TEXT,
  performed_by TEXT,
  performed_at TIMESTAMP DEFAULT NOW()
);
```

### 🛠️ Error Handling

Custom error types:
- `TicketError`: Base error
- `ValidationError`: Input validation
- `PermissionError`: Authorization failures
- `CooldownError`: On cooldown with expiration time
- `DatabaseError`: Database operations
- `NotFoundError`: Resource not found

All errors are caught and logged via the logging service.

### 📈 Metrics Tracked

- Tickets created (daily)
- Tickets resolved (daily)
- Errors by type (daily)
- Operation timings

### 🔄 Background Jobs

- **CooldownCleanupJob**: Monitors cooldown expiration (hourly)
- **ReconciliationJob**: Syncs Discord state with database (hourly)

### 🧪 Testing

Run integration tests:

```javascript
import TicketSystemTest from './modules/tickets/tests/ticket-system-test.js';

const test = new TicketSystemTest(ticketsModule);
await test.runAllTests();
```

## Development

### Adding New Features

1. Create a new handler in `handlers/`
2. Add routes to `interaction-router.js`
3. Add components as needed in `components/`
4. Use existing services or create new ones
5. Update tests

### Adding New Services

1. Create service in `services/`
2. Export from `index.js`
3. Inject into handlers that need it
4. Add tests

### Database Migrations

1. Create migration in `supabase/migrations/`
2. Update schema comments
3. Update table references in repositories

## Performance Optimizations

- **Redis caching**: Webhook, cooldowns, locks
- **Distributed locks**: Prevent race conditions
- **Batch operations**: Promise.allSettled for parallel ops
- **Connection pooling**: Database and Redis
- **Retry logic**: Exponential backoff for API calls
- **Logging levels**: Debug/Info/Warn/Error

## Security Considerations

- ✅ Permission checking on all operations
- ✅ Input validation on all user inputs
- ✅ Rate limiting via Discord API
- ✅ No local state persistence
- ✅ Proper error messages (no data leaks)
- ✅ Distributed locking to prevent TOCTOU bugs

## Maintenance

- Clear old tickets: Use `cleanupService.archiveOldTickets()`
- Monitor metrics: `services.metrics.getMetricsSnapshot()`
- Check reconciliation: `services.reconciliation.getLastReconciliationTime()`
- View active cooldowns: `repositories.cooldown.getAllActiveCooldowns()`

---

**Status**: Enterprise-ready | **Version**: 3.0.0 | **Last Updated**: 2026-05-12
