import { ticketService } from './ticket-service.js';
import { cooldownService } from './cooldown-service.js';
import { lockService } from './lock-service.js';
import { discordRestService } from './discord-rest-service.js';
import { reconciliationService } from './reconciliation-service.js';
import redisClient from '../../../core/redis.js';

/**
 * Cleanup service with singleton safety and guards
 * Handles periodic cleanup tasks with distributed locking
 */
export class CleanupService {
  constructor() {
    this.isRunning = false;
    this.cleanupJobs = new Map();
    this.defaultInterval = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Start all cleanup jobs with singleton safety
   */
  async startCleanupJobs(client) {
    if (this.isRunning) {
      console.log('Cleanup jobs already running');
      return;
    }

    this.isRunning = true;
    console.log('🧹 Starting cleanup jobs...');

    // Start periodic cleanup jobs
    this.startPeriodicJob('expired-cooldowns', () => this.cleanupExpiredCooldowns(), 5 * 60 * 1000);
    this.startPeriodicJob('stale-creation-attempts', () => this.cleanupStaleCreationAttempts(), 10 * 60 * 1000);
    this.startPeriodicJob('orphaned-tickets', () => this.cleanupOrphanedTickets(client), 30 * 60 * 1000);
    this.startPeriodicJob('health-check', () => this.performHealthCheck(client), 15 * 60 * 1000);
    this.startPeriodicJob('webhook-validation', () => this.validateWebhookCache(client), 60 * 60 * 1000);

    console.log('✅ Cleanup jobs started');
  }

  /**
   * Stop all cleanup jobs
   */
  async stopCleanupJobs() {
    console.log('🛑 Stopping cleanup jobs...');
    
    for (const [jobName, intervalId] of this.cleanupJobs.entries()) {
      clearInterval(intervalId);
      console.log(`Stopped job: ${jobName}`);
    }
    
    this.cleanupJobs.clear();
    this.isRunning = false;
    
    console.log('✅ All cleanup jobs stopped');
  }

  /**
   * Start a periodic job with singleton safety
   */
  startPeriodicJob(jobName, jobFunction, intervalMs) {
    if (this.cleanupJobs.has(jobName)) {
      console.warn(`Job ${jobName} is already running`);
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        await this.runSingletonJob(jobName, jobFunction);
      } catch (error) {
        console.error(`Job ${jobName} failed:`, error);
      }
    }, intervalMs);

    this.cleanupJobs.set(jobName, intervalId);
    console.log(`Started job: ${jobName} (interval: ${intervalMs}ms)`);
  }

  /**
   * Run a job with singleton safety using distributed locks
   */
  async runSingletonJob(jobName, jobFunction) {
    const lockKey = `cleanup:job:${jobName}`;
    const lockValue = await lockService.acquireWebhookLock(lockKey, 60000); // 1 minute timeout
    
    if (!lockValue) {
      console.log(`Job ${jobName} is already running in another instance`);
      return;
    }

    const startTime = Date.now();
    console.log(`🔄 Running cleanup job: ${jobName}`);

    try {
      const result = await jobFunction();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Job ${jobName} completed in ${duration}ms`);
      
      // Store job metrics
      await this.storeJobMetrics(jobName, { success: true, duration, result });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`❌ Job ${jobName} failed after ${duration}ms:`, error);
      
      // Store job metrics
      await this.storeJobMetrics(jobName, { success: false, duration, error: error.message });
      
      throw error;
    } finally {
      await lockService.releaseWebhookLock(lockKey, lockValue);
    }
  }

  /**
   * Cleanup expired cooldowns with safety guards
   */
  async cleanupExpiredCooldowns() {
    const result = {
      dbCooldownsCleaned: 0,
      redisCooldownsCleaned: 0,
      errors: []
    };

    try {
      // Clean database cooldowns
      const dbResult = await ticketService.cleanupExpiredCooldowns();
      result.dbCooldownsCleaned = dbResult;

      // Clean Redis cooldowns
      const redisResult = await this.cleanupRedisCooldowns();
      result.redisCooldownsCleaned = redisResult;

    } catch (error) {
      result.errors.push(error.message);
      console.error('Failed to cleanup expired cooldowns:', error);
    }

    return result;
  }

  /**
   * Cleanup Redis cooldowns
   */
  async cleanupRedisCooldowns() {
    const client = redisClient.getClient();
    if (!client) return 0;

    try {
      const pattern = 'ticket:cooldown:*';
      const keys = await client.keys(pattern);
      let cleaned = 0;

      for (const key of keys) {
        try {
          const ttl = await client.ttl(key);
          if (ttl === -1 || ttl === -2) { // No TTL or key doesn't exist
            await client.del(key);
            cleaned++;
          }
        } catch (error) {
          console.warn(`Failed to cleanup Redis key ${key}:`, error);
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup Redis cooldowns:', error);
      return 0;
    }
  }

  /**
   * Cleanup stale creation attempts with safety guards
   */
  async cleanupStaleCreationAttempts() {
    try {
      const cleaned = await discordRestService.cleanupStaleCreationAttempts();
      return { cleaned, message: `Cleaned ${cleaned} stale attempts` };
    } catch (error) {
      console.error('Failed to cleanup stale creation attempts:', error);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * Cleanup orphaned tickets with safety guards
   */
  async cleanupOrphanedTickets(client) {
    const result = {
      checked: 0,
      orphaned: 0,
      fixed: 0,
      errors: []
    };

    try {
      // Get all tickets that might be orphaned
      const tickets = await ticketService.getTicketsOlderThan(24 * 60 * 60 * 1000); // 24 hours
      result.checked = tickets.length;

      for (const ticket of tickets) {
        try {
          // Check if thread still exists
          const thread = await client.channels.fetch(ticket.thread_id).catch(() => null);
          
          if (!thread) {
            result.orphaned++;
            
            // Mark as archived in database
            await ticketService.updateTicketStatus(ticket.thread_id, 'archived');
            result.fixed++;
            
            console.log(`🔴 Archived orphaned ticket: ${ticket.thread_id}`);
          }
        } catch (error) {
          result.errors.push(`Failed to check ticket ${ticket.thread_id}: ${error.message}`);
        }
      }

    } catch (error) {
      result.errors.push(error.message);
      console.error('Failed to cleanup orphaned tickets:', error);
    }

    return result;
  }

  /**
   * Perform health check with safety guards
   */
  async performHealthCheck(client) {
    try {
      const health = await reconciliationService.performHealthCheck(client);
      
      // Alert on unhealthy components
      if (health.database.status !== 'healthy') {
        console.warn('⚠️ Database health check failed:', health.database);
      }
      
      if (health.redis.status !== 'healthy') {
        console.warn('⚠️ Redis health check failed:', health.redis);
      }
      
      if (health.discord.status !== 'healthy') {
        console.warn('⚠️ Discord health check failed:', health.discord);
      }
      
      return health;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Validate webhook cache with safety guards
   */
  async validateWebhookCache(client) {
    const result = {
      checked: 0,
      valid: 0,
      invalid: 0,
      errors: []
    };

    try {
      // Get all log channels that might have webhooks
      const logChannelId = '1485668403132760243'; // From constants
      const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
      
      if (logChannel) {
        result.checked++;
        
        const isValid = await discordRestService.validateWebhookCache(logChannel);
        if (isValid) {
          result.valid++;
        } else {
          result.invalid++;
        }
      }

    } catch (error) {
      result.errors.push(error.message);
      console.error('Failed to validate webhook cache:', error);
    }

    return result;
  }

  /**
   * Store job metrics for monitoring
   */
  async storeJobMetrics(jobName, metrics) {
    try {
      const key = `cleanup:metrics:${jobName}`;
      const value = JSON.stringify({
        ...metrics,
        timestamp: new Date().toISOString()
      });
      
      await redisClient.setWithTTL(key, value, 24 * 60 * 60 * 1000); // 24 hours
    } catch (error) {
      console.warn(`Failed to store metrics for ${jobName}:`, error);
    }
  }

  /**
   * Get job metrics
   */
  async getJobMetrics(jobName) {
    try {
      const key = `cleanup:metrics:${jobName}`;
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn(`Failed to get metrics for ${jobName}:`, error);
      return null;
    }
  }

  /**
   * Get all job statuses
   */
  getJobStatuses() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.cleanupJobs.keys()),
      jobCount: this.cleanupJobs.size
    };
  }

  /**
   * Force run a specific job (for manual triggering)
   */
  async forceRunJob(jobName, client) {
    const jobFunctions = {
      'expired-cooldowns': () => this.cleanupExpiredCooldowns(),
      'stale-creation-attempts': () => this.cleanupStaleCreationAttempts(),
      'orphaned-tickets': () => this.cleanupOrphanedTickets(client),
      'health-check': () => this.performHealthCheck(client),
      'webhook-validation': () => this.validateWebhookCache(client)
    };

    const jobFunction = jobFunctions[jobName];
    if (!jobFunction) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    console.log(`🔄 Force running job: ${jobName}`);
    return await this.runSingletonJob(jobName, jobFunction);
  }

  /**
   * Cleanup resources on shutdown
   */
  async destroy() {
    await this.stopCleanupJobs();
    console.log('🔧 Cleanup service destroyed');
  }
}

export const cleanupService = new CleanupService();
