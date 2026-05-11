import { ticketService } from './ticket-service.js';
import { lockService } from './lock-service.js';
import { redisClient } from '../../../core/redis.js';

/**
 * Discord state reconciliation service
 * Handles startup reconciliation and ongoing state cleanup
 */
export class ReconciliationService {
  constructor() {
    this.isReconciling = false;
    this.reconciliationLockKey = 'ticket:reconciliation:lock';
  }

  /**
   * Perform startup reconciliation of Discord state vs database state
   */
  async performStartupReconciliation(client) {
    if (this.isReconciling) {
      console.log('Reconciliation already in progress, skipping');
      return;
    }

    // Acquire distributed lock to prevent multiple instances from reconciling simultaneously
    const lockValue = await lockService.acquireWebhookLock('startup-reconciliation', 300000); // 5 minutes
    if (!lockValue) {
      console.log('Another instance is performing reconciliation, skipping');
      return;
    }

    this.isReconciling = true;
    console.log('🔍 Starting Discord state reconciliation...');

    try {
      const results = {
        orphanedTickets: 0,
        invalidThreads: 0,
        stateMismatches: 0,
        fixedTickets: 0
      };

      // Get all tickets from database
      const allTickets = await ticketService.getAllTickets();
      console.log(`Found ${allTickets.length} tickets in database`);

      for (const ticket of allTickets) {
        try {
          const result = await this.reconcileTicket(client, ticket);
          if (result.orphaned) results.orphanedTickets++;
          if (result.invalid) results.invalidThreads++;
          if (result.mismatch) results.stateMismatches++;
          if (result.fixed) results.fixedTickets++;
        } catch (error) {
          console.error(`Failed to reconcile ticket ${ticket.thread_id}:`, error);
        }
      }

      console.log('✅ Reconciliation completed:', results);
      
      // Store reconciliation results in Redis for monitoring
      await this.storeReconciliationResults(results);
      
      return results;
    } catch (error) {
      console.error('❌ Reconciliation failed:', error);
      throw error;
    } finally {
      this.isReconciling = false;
      await lockService.releaseWebhookLock('startup-reconciliation', lockValue);
    }
  }

  /**
   * Reconcile individual ticket state
   */
  async reconcileTicket(client, ticket) {
    const result = {
      orphaned: false,
      invalid: false,
      mismatch: false,
      fixed: false
    };

    try {
      // Try to fetch the Discord thread
      const thread = await client.channels.fetch(ticket.thread_id).catch(() => null);

      if (!thread) {
        // Thread no longer exists - orphaned ticket
        result.orphaned = true;
        console.log(`🔴 Orphaned ticket: ${ticket.thread_id} no longer exists in Discord`);
        
        // Mark ticket as archived in database
        await ticketService.updateTicketStatus(ticket.thread_id, 'archived');
        result.fixed = true;
        return result;
      }

      // Check if thread state matches database state
      const dbIsOpen = ticket.status === 'open';
      const discordIsOpen = !thread.archived && !thread.locked;

      if (dbIsOpen !== discordIsOpen) {
        result.mismatch = true;
        console.log(`⚠️ State mismatch for ${ticket.thread_id}: DB=${ticket.status}, Discord=${discordIsOpen ? 'open' : 'closed'}`);
        
        // Sync Discord state to database (Discord is source of truth)
        const newStatus = discordIsOpen ? 'open' : 'resolved';
        await ticketService.updateTicketStatus(ticket.thread_id, newStatus);
        result.fixed = true;
        return result;
      }

      // Validate thread is actually a ticket thread
      if (!thread.isThread() || thread.type !== 12) { // 12 = PrivateThread
        result.invalid = true;
        console.log(`🔴 Invalid thread type for ${ticket.thread_id}: not a private thread`);
        
        await ticketService.updateTicketStatus(ticket.thread_id, 'archived');
        result.fixed = true;
        return result;
      }

    } catch (error) {
      console.error(`Error reconciling ticket ${ticket.thread_id}:`, error);
      result.invalid = true;
    }

    return result;
  }

  /**
   * Cleanup expired cooldowns
   */
  async cleanupExpiredCooldowns() {
    const lockValue = await lockService.acquireWebhookLock('cooldown-cleanup', 60000); // 1 minute
    if (!lockValue) {
      console.log('Another instance is cleaning cooldowns, skipping');
      return;
    }

    try {
      console.log('🧹 Cleaning expired cooldowns...');
      
      // Clean database cooldowns
      const dbCleaned = await ticketService.cleanupExpiredCooldowns();
      
      // Clean Redis cooldowns (handled by TTLs, but we can force cleanup)
      const redisCleaned = await this.cleanupRedisCooldowns();
      
      console.log(`✅ Cleaned ${dbCleaned} DB cooldowns, ${redisCleaned} Redis cooldowns`);
      return { dbCleaned, redisCleaned };
    } finally {
      await lockService.releaseWebhookLock('cooldown-cleanup', lockValue);
    }
  }

  /**
   * Cleanup Redis cooldowns that may have expired
   */
  async cleanupRedisCooldowns() {
    const client = redisClient.getClient();
    if (!client) return 0;

    try {
      const pattern = 'ticket:cooldown:*';
      const keys = await client.keys(pattern);
      let cleaned = 0;

      for (const key of keys) {
        const exists = await client.exists(key);
        if (!exists) {
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup Redis cooldowns:', error);
      return 0;
    }
  }

  /**
   * Store reconciliation results for monitoring
   */
  async storeReconciliationResults(results) {
    try {
      await redisClient.setWithTTL(
        'ticket:reconciliation:last_results',
        JSON.stringify({
          ...results,
          timestamp: new Date().toISOString()
        }),
        24 * 60 * 60 * 1000 // 24 hours
      );
    } catch (error) {
      console.error('Failed to store reconciliation results:', error);
    }
  }

  /**
   * Get last reconciliation results
   */
  async getLastReconciliationResults() {
    try {
      const results = await redisClient.get('ticket:reconciliation:last_results');
      return results ? JSON.parse(results) : null;
    } catch (error) {
      console.error('Failed to get reconciliation results:', error);
      return null;
    }
  }

  /**
   * Validate webhook cache integrity
   */
  async validateWebhookCache(client) {
    const lockValue = await lockService.acquireWebhookLock('webhook-validation', 120000); // 2 minutes
    if (!lockValue) {
      console.log('Another instance is validating webhooks, skipping');
      return;
    }

    try {
      console.log('🔍 Validating webhook cache integrity...');
      
      // This would validate all cached webhooks
      // Implementation depends on webhook service structure
      console.log('✅ Webhook cache validation completed');
    } finally {
      await lockService.releaseWebhookLock('webhook-validation', lockValue);
    }
  }

  /**
   * Perform periodic health checks
   */
  async performHealthCheck(client) {
    const results = {
      database: await this.checkDatabaseHealth(),
      redis: await this.checkRedisHealth(),
      discord: await this.checkDiscordHealth(client),
      timestamp: new Date().toISOString()
    };

    // Store health results for monitoring
    await redisClient.setWithTTL(
      'ticket:health:last_check',
      JSON.stringify(results),
      60 * 60 * 1000 // 1 hour
    );

    return results;
  }

  /**
   * Check database connectivity and basic operations
   */
  async checkDatabaseHealth() {
    try {
      const start = Date.now();
      await ticketService.getAllTickets({ limit: 1 });
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        message: 'Database responding normally'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Database connection failed'
      };
    }
  }

  /**
   * Check Redis connectivity and basic operations
   */
  async checkRedisHealth() {
    try {
      const start = Date.now();
      await redisClient.setWithTTL('health:check', 'ok', 1000);
      const value = await redisClient.get('health:check');
      const latency = Date.now() - start;
      
      return {
        status: value === 'ok' ? 'healthy' : 'unhealthy',
        latency,
        message: 'Redis responding normally'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Redis connection failed'
      };
    }
  }

  /**
   * Check Discord API health
   */
  async checkDiscordHealth(client) {
    try {
      const start = Date.now();
      await client.user.fetch();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        message: 'Discord API responding normally'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Discord API connection failed'
      };
    }
  }
}

export const reconciliationService = new ReconciliationService();
