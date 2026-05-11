import { ticketRepository } from '../repositories/ticket-repository.js';
import { cooldownService } from '../services/cooldown-service.js';
import { loggingService } from '../services/logging-service.js';
import { metricsService } from '../services/metrics-service.js';
import { generateRedisKey } from '../utils/redis-keys.js';
import { redisClient } from '../../../core/redis.js';
import { 
  RECONCILIATION_INTERVAL,
  RECONCILIATION_BATCH_SIZE,
  REDIS_TTL
} from '../utils/constants.js';

/**
 * Enterprise-grade ticket reconciliation job
 * Ensures data consistency between Discord threads and database records
 */

/**
 * Main reconciliation job function
 * Runs periodically to sync Discord state with database
 */
export async function runReconciliationJob() {
  const jobId = `reconciliation_${Date.now()}`;
  const context = {
    operation: 'reconciliation_job',
    jobId,
    startTime: new Date().toISOString()
  };

  const timer = metricsService.createTimer();

  try {
    await loggingService.info({
      operation: 'reconciliation_job_start',
      ...context,
      message: 'Starting ticket reconciliation job'
    });

    // Acquire job lock to prevent concurrent runs
    const lockKey = generateRedisKey('lock', 'reconciliation');
    const lockValue = await redisClient.acquireLock(lockKey, RECONCILIATION_INTERVAL);
    
    if (!lockValue) {
      await loggingService.warn({
        operation: 'reconciliation_job_skip',
        ...context,
        message: 'Reconciliation job already running, skipping'
      });
      return;
    }

    try {
      // Step 1: Reconcile Discord threads with database
      await reconcileThreadsWithDatabase(context);
      
      // Step 2: Reconcile database records with Discord
      await reconcileDatabaseWithDiscord(context);
      
      // Step 3: Clean up orphaned records
      await cleanupOrphanedRecords(context);
      
      // Step 4: Reconcile cooldowns
      await reconcileCooldowns(context);

      const duration = timer.stop();
      await metricsService.recordReconciliationJob(duration, true, {
        jobId,
        recordsProcessed: 'unknown'
      });

      await loggingService.info({
        operation: 'reconciliation_job_complete',
        ...context,
        message: 'Reconciliation job completed successfully',
        metadata: { duration }
      });

    } finally {
      // Release job lock
      await redisClient.releaseLock(lockKey, lockValue);
    }

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordReconciliationJob(duration, false, {
      jobId,
      error: error.message
    });

    await loggingService.error({
      operation: 'reconciliation_job_error',
      ...context,
      message: 'Reconciliation job failed',
      metadata: { error: error.message, stack: error.stack }
    });
  }
}

/**
 * Reconcile Discord threads with database records
 * @param {Object} context - Job context
 */
async function reconcileThreadsWithDatabase(context) {
  await loggingService.info({
    operation: 'reconcile_threads_to_db',
    ...context,
    message: 'Starting thread-to-database reconciliation'
  });

  // Get all guilds the bot is in
  const guilds = await getBotGuilds();
  
  for (const guild of guilds) {
    try {
      // Get all ticket threads in the guild
      const threads = await getTicketThreads(guild.id);
      
      for (const thread of threads) {
        await reconcileSingleThread(thread, context);
      }
    } catch (error) {
      await loggingService.warn({
        operation: 'reconcile_guild_error',
        ...context,
        message: `Failed to reconcile guild ${guild.id}`,
        metadata: { guildId: guild.id, error: error.message }
      });
    }
  }
}

/**
 * Reconcile a single thread with database
 * @param {Object} thread - Discord thread object
 * @param {Object} context - Job context
 */
async function reconcileSingleThread(thread, context) {
  try {
    // Check if thread has a ticket record
    const ticket = await ticketRepository.findByThreadId(thread.id);
    
    if (!ticket) {
      // Create missing database record
      await createMissingTicketRecord(thread, context);
    } else {
      // Update existing record with current state
      await updateTicketRecordState(ticket, thread, context);
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'reconcile_thread_error',
      ...context,
      message: `Failed to reconcile thread ${thread.id}`,
      metadata: { threadId: thread.id, error: error.message }
    });
  }
}

/**
 * Create missing ticket record for Discord thread
 * @param {Object} thread - Discord thread object
 * @param {Object} context - Job context
 */
async function createMissingTicketRecord(thread, context) {
  try {
    // Extract ticket information from thread name and metadata
    const ticketInfo = extractTicketInfoFromThread(thread);
    
    if (ticketInfo.isValid) {
      const ticketData = {
        guildId: thread.guildId,
        threadId: thread.id,
        creatorId: ticketInfo.creatorId,
        tag: ticketInfo.tag,
        tagLabel: ticketInfo.tagLabel,
        threadName: thread.name,
        status: thread.archived ? 'closed' : 'open',
        createdAt: thread.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await ticketRepository.create(ticketData);
      
      await loggingService.info({
        operation: 'create_missing_ticket',
        ...context,
        message: `Created missing ticket record for thread ${thread.id}`,
        metadata: { threadId: thread.id, creatorId: ticketInfo.creatorId }
      });
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'create_missing_ticket_error',
      ...context,
      message: `Failed to create ticket record for thread ${thread.id}`,
      metadata: { threadId: thread.id, error: error.message }
    });
  }
}

/**
 * Update ticket record with current Discord state
 * @param {Object} ticket - Database ticket record
 * @param {Object} thread - Discord thread object
 * @param {Object} context - Job context
 */
async function updateTicketRecordState(ticket, thread, context) {
  try {
    const updates = {};
    
    // Update status based on thread state
    if (thread.archived && ticket.status !== 'closed') {
      updates.status = 'closed';
      updates.closed_at = new Date().toISOString();
    } else if (!thread.archived && ticket.status === 'closed') {
      updates.status = 'open';
      updates.reopened_at = new Date().toISOString();
    }
    
    // Update thread name if changed
    if (thread.name !== ticket.thread_name) {
      updates.thread_name = thread.name;
    }
    
    // Update last activity
    updates.last_activity_at = new Date().toISOString();
    
    if (Object.keys(updates).length > 0) {
      await ticketRepository.update(ticket.id, updates);
      
      await loggingService.info({
        operation: 'update_ticket_state',
        ...context,
        message: `Updated ticket record ${ticket.id}`,
        metadata: { ticketId: ticket.id, updates }
      });
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'update_ticket_state_error',
      ...context,
      message: `Failed to update ticket record ${ticket.id}`,
      metadata: { ticketId: ticket.id, error: error.message }
    });
  }
}

/**
 * Reconcile database records with Discord
 * @param {Object} context - Job context
 */
async function reconcileDatabaseWithDiscord(context) {
  await loggingService.info({
    operation: 'reconcile_db_to_discord',
    ...context,
    message: 'Starting database-to-Discord reconciliation'
  });

  // Get all open tickets from database
  const openTickets = await ticketRepository.findOpenTickets();
  
  for (const ticket of openTickets) {
    await reconcileTicketWithDiscord(ticket, context);
  }
}

/**
 * Reconcile single ticket record with Discord
 * @param {Object} ticket - Database ticket record
 * @param {Object} context - Job context
 */
async function reconcileTicketWithDiscord(ticket, context) {
  try {
    // Try to fetch the Discord thread
    const thread = await getDiscordThread(ticket.thread_id);
    
    if (!thread) {
      // Thread doesn't exist in Discord, mark ticket as orphaned
      await handleOrphanedTicket(ticket, context);
    } else {
      // Check if thread state matches database
      await validateThreadState(ticket, thread, context);
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'reconcile_ticket_error',
      ...context,
      message: `Failed to reconcile ticket ${ticket.id}`,
      metadata: { ticketId: ticket.id, error: error.message }
    });
  }
}

/**
 * Handle orphaned ticket (thread doesn't exist in Discord)
 * @param {Object} ticket - Database ticket record
 * @param {Object} context - Job context
 */
async function handleOrphanedTicket(ticket, context) {
  try {
    // Mark ticket as orphaned in database
    await ticketRepository.update(ticket.id, {
      status: 'orphaned',
      orphaned_at: new Date().toISOString()
    });
    
    await loggingService.warn({
      operation: 'handle_orphaned_ticket',
      ...context,
      message: `Marked ticket ${ticket.id} as orphaned`,
      metadata: { ticketId: ticket.id, threadId: ticket.thread_id }
    });
  } catch (error) {
    await loggingService.warn({
      operation: 'handle_orphaned_ticket_error',
      ...context,
      message: `Failed to handle orphaned ticket ${ticket.id}`,
      metadata: { ticketId: ticket.id, error: error.message }
    });
  }
}

/**
 * Validate thread state against database record
 * @param {Object} ticket - Database ticket record
 * @param {Object} thread - Discord thread object
 * @param {Object} context - Job context
 */
async function validateThreadState(ticket, thread, context) {
  try {
    const issues = [];
    
    // Check status consistency
    if (thread.archived && ticket.status !== 'closed') {
      issues.push('Thread is archived but ticket status is not closed');
    } else if (!thread.archived && ticket.status === 'closed') {
      issues.push('Thread is not archived but ticket status is closed');
    }
    
    // Check name consistency
    if (thread.name !== ticket.thread_name) {
      issues.push(`Thread name mismatch: DB="${ticket.thread_name}" Discord="${thread.name}"`);
    }
    
    if (issues.length > 0) {
      await loggingService.warn({
        operation: 'thread_state_inconsistency',
        ...context,
        message: `State inconsistency detected for ticket ${ticket.id}`,
        metadata: { ticketId: ticket.id, threadId: ticket.thread_id, issues }
      });
      
      // Auto-correct simple inconsistencies
      await autoCorrectTicketState(ticket, thread, issues, context);
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'validate_thread_state_error',
      ...context,
      message: `Failed to validate thread state for ticket ${ticket.id}`,
      metadata: { ticketId: ticket.id, error: error.message }
    });
  }
}

/**
 * Auto-correct simple state inconsistencies
 * @param {Object} ticket - Database ticket record
 * @param {Object} thread - Discord thread object
 * @param {Array} issues - Array of detected issues
 * @param {Object} context - Job context
 */
async function autoCorrectTicketState(ticket, thread, issues, context) {
  try {
    const updates = {};
    
    // Auto-correct status
    if (thread.archived && ticket.status !== 'closed') {
      updates.status = 'closed';
      updates.closed_at = new Date().toISOString();
    } else if (!thread.archived && ticket.status === 'closed') {
      updates.status = 'open';
      updates.reopened_at = new Date().toISOString();
    }
    
    // Auto-correct thread name
    if (thread.name !== ticket.thread_name) {
      updates.thread_name = thread.name;
    }
    
    if (Object.keys(updates).length > 0) {
      await ticketRepository.update(ticket.id, updates);
      
      await loggingService.info({
        operation: 'auto_correct_ticket',
        ...context,
        message: `Auto-corrected ticket ${ticket.id}`,
        metadata: { ticketId: ticket.id, updates, correctedIssues: issues }
      });
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'auto_correct_ticket_error',
      ...context,
      message: `Failed to auto-correct ticket ${ticket.id}`,
      metadata: { ticketId: ticket.id, error: error.message }
    });
  }
}

/**
 * Clean up orphaned records
 * @param {Object} context - Job context
 */
async function cleanupOrphanedRecords(context) {
  await loggingService.info({
    operation: 'cleanup_orphaned_records',
    ...context,
    message: 'Starting orphaned records cleanup'
  });

  try {
    // Clean up old orphaned tickets
    const deletedCount = await ticketRepository.deleteOldOrphanedTickets(30); // 30 days
    
    if (deletedCount > 0) {
      await loggingService.info({
        operation: 'cleanup_orphaned_records_complete',
        ...context,
        message: `Cleaned up ${deletedCount} orphaned tickets`
      });
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'cleanup_orphaned_records_error',
      ...context,
      message: 'Failed to cleanup orphaned records',
      metadata: { error: error.message }
    });
  }
}

/**
 * Reconcile cooldowns with current state
 * @param {Object} context - Job context
 */
async function reconcileCooldowns(context) {
  await loggingService.info({
    operation: 'reconcile_cooldowns',
    ...context,
    message: 'Starting cooldown reconciliation'
  });

  try {
    // Get all active cooldowns from database
    const activeCooldowns = await cooldownService.getActiveCooldowns();
    
    for (const cooldown of activeCooldowns) {
      await reconcileSingleCooldown(cooldown, context);
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'reconcile_cooldowns_error',
      ...context,
      message: 'Failed to reconcile cooldowns',
      metadata: { error: error.message }
    });
  }
}

/**
 * Reconcile single cooldown
 * @param {Object} cooldown - Cooldown record
 * @param {Object} context - Job context
 */
async function reconcileSingleCooldown(cooldown, context) {
  try {
    // Check if cooldown has expired
    const remaining = await cooldownService.getRemainingCooldown(cooldown.guild_id, cooldown.user_id);
    
    if (remaining <= 0) {
      // Clean up expired cooldown
      await cooldownService.clearCooldown(cooldown.guild_id, cooldown.user_id);
      
      await loggingService.info({
        operation: 'cleanup_expired_cooldown',
        ...context,
        message: `Cleaned up expired cooldown for user ${cooldown.user_id}`,
        metadata: { userId: cooldown.user_id, guildId: cooldown.guild_id }
      });
    }
  } catch (error) {
    await loggingService.warn({
      operation: 'reconcile_cooldown_error',
      ...context,
      message: `Failed to reconcile cooldown for user ${cooldown.user_id}`,
      metadata: { userId: cooldown.user_id, error: error.message }
    });
  }
}

/**
 * Helper function to get bot guilds
 * @returns {Array} Array of guild objects
 */
async function getBotGuilds() {
  // This would be implemented based on your Discord client
  // For now, return empty array
  return [];
}

/**
 * Helper function to get ticket threads from guild
 * @param {string} guildId - Guild ID
 * @returns {Array} Array of thread objects
 */
async function getTicketThreads(guildId) {
  // This would be implemented based on your Discord client
  // For now, return empty array
  return [];
}

/**
 * Helper function to get Discord thread
 * @param {string} threadId - Thread ID
 * @returns {Object|null} Thread object or null
 */
async function getDiscordThread(threadId) {
  // This would be implemented based on your Discord client
  // For now, return null
  return null;
}

/**
 * Extract ticket information from thread name/metadata
 * @param {Object} thread - Discord thread object
 * @returns {Object} Ticket information
 */
function extractTicketInfoFromThread(thread) {
  // This would parse the thread name to extract ticket information
  // For now, return basic structure
  return {
    isValid: false,
    creatorId: null,
    tag: null,
    tagLabel: null
  };
}

/**
 * Start reconciliation job scheduler
 * @param {number} interval - Interval in milliseconds
 */
export function startReconciliationScheduler(interval = RECONCILIATION_INTERVAL) {
  setInterval(async () => {
    await runReconciliationJob();
  }, interval);
  
  loggingService.info({
    operation: 'reconciliation_scheduler_start',
    message: 'Reconciliation job scheduler started',
    metadata: { interval }
  });
}
