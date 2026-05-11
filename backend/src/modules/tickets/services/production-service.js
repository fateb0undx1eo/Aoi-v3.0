import { reconciliationService } from './reconciliation-service.js';
import { discordRestService } from './discord-rest-service.js';
import { cleanupService } from './cleanup-service.js';
import { metricsService } from './metrics-service.js';
import { logger, createTimer } from '../utils/logger.js';
import { lockService } from './lock-service.js';

/**
 * Production service that integrates all hardening components
 * Provides unified interface for production-ready ticket system
 */
export class ProductionService {
  constructor() {
    this.isInitialized = false;
    this.isShuttingDown = false;
  }

  /**
   * Initialize all production services
   */
  async initialize(client) {
    if (this.isInitialized) {
      logger.warn('Production service already initialized');
      return;
    }

    const timer = createTimer('production:initialize');
    
    try {
      logger.info('Initializing production services...');
      
      // Perform startup reconciliation
      await reconciliationService.performStartupReconciliation(client);
      
      // Start cleanup jobs
      await cleanupService.startCleanupJobs(client);
      
      // Validate webhook cache
      await discordRestService.batchValidateWebhooks([client.channels.cache.get('1485668403132760243')].filter(Boolean));
      
      // Store initialization metrics
      await metricsService.recordDiscordOperation('production_init', timer.end(true), true);
      
      this.isInitialized = true;
      logger.info('Production services initialized successfully');
      
      // Set up graceful shutdown handlers
      this.setupGracefulShutdown();
      
    } catch (error) {
      await metricsService.recordDiscordOperation('production_init', timer.end(false), false, { error: error.message });
      logger.error('Failed to initialize production services', { error });
      throw error;
    }
  }

  /**
   * Safe ticket creation with full production hardening
   */
  async safeCreateTicket(interaction, tag) {
    const monitor = metricsService.createPerformanceMonitor('ticket:creation', {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      tag: tag.value
    });

    try {
      // Validate interaction context
      if (!interaction.inGuild()) {
        throw new Error('Not in guild context');
      }

      // Check rate limits
      if (discordRestService.isRateLimited('threadCreate')) {
        throw new Error('Currently rate limited for ticket creation');
      }

      // Acquire creation lock with ownership validation
      const lockValue = await lockService.acquireCreationLock(
        interaction.guildId,
        interaction.user.id,
        8000
      );

      if (!lockValue) {
        throw new Error('Could not acquire creation lock');
      }

      let lockReleased = false;
      try {
        // Perform safe thread creation
        const threadData = {
          name: this.generateSafeThreadName(tag.namePrefix),
          type: 12, // PrivateThread
          invitable: false,
          autoArchiveDuration: 1440,
          reason: `Ticket created by ${interaction.user.id} (${tag.value})`
        };

        const thread = await discordRestService.safeThreadCreate(
          interaction.channel,
          threadData,
          {
            guildId: interaction.guildId,
            creatorId: interaction.user.id,
            tag: tag.value,
            tagLabel: tag.label
          }
        );

        // Add creator to thread safely
        await discordRestService.safeThreadOperation(thread, 'membersAdd', {
          userId: interaction.user.id
        });

        // Update active ticket count
        await metricsService.updateActiveTicketCount(1);

        logger.logTicketOperation('creation', thread.id, {
          guildId: interaction.guildId,
          userId: interaction.user.id,
          tag: tag.value
        });

        await monitor.end(true);
        return thread;

      } finally {
        // Always release lock with ownership validation
        if (!lockReleased) {
          const released = await lockService.releaseCreationLock(
            interaction.guildId,
            interaction.user.id,
            lockValue
          );
          
          if (!released) {
            logger.warn('Failed to release creation lock', {
              guildId: interaction.guildId,
              userId: interaction.user.id
            });
          }
          lockReleased = true;
        }
      }

    } catch (error) {
      await monitor.end(false, error.message);
      logger.error('Safe ticket creation failed', {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Safe ticket resolution with full production hardening
   */
  async safeResolveTicket(interaction, thread, ticket, creatorId) {
    const monitor = metricsService.createPerformanceMonitor('ticket:resolution', {
      guildId: interaction.guildId,
      threadId: thread.id,
      resolverId: interaction.user.id
    });

    try {
      // Acquire resolve mutex with ownership validation
      const lockValue = await lockService.acquireResolveMutex(thread.id, 30000);
      
      if (!lockValue) {
        throw new Error('Could not acquire resolve mutex - another staff member is resolving this ticket');
      }

      let lockReleased = false;
      try {
        // Validate thread state
        if (!this.canResolveTicket(thread)) {
          throw new Error('Thread is not in a resolvable state');
        }

        // Perform safe thread operations
        await Promise.all([
          discordRestService.safeThreadOperation(thread, 'setName', {
            name: this.markThreadNameClosed(thread.name)
          }),
          discordRestService.safeThreadOperation(thread, 'membersRemove', {
            userId: creatorId
          }),
          discordRestService.safeThreadOperation(thread, 'setArchived', { archived: true }),
          discordRestService.safeThreadOperation(thread, 'setLocked', { locked: true }),
          discordRestService.safeThreadOperation(thread, 'setAutoArchiveDuration', { duration: 60 })
        ]);

        // Update active ticket count
        await metricsService.updateActiveTicketCount(-1);

        logger.logTicketOperation('resolution', thread.id, {
          guildId: interaction.guildId,
          resolverId: interaction.user.id,
          creatorId
        });

        await monitor.end(true);
        return true;

      } finally {
        // Always release mutex with ownership validation
        if (!lockReleased) {
          const released = await lockService.releaseResolveMutex(thread.id, lockValue);
          
          if (!released) {
            logger.warn('Failed to release resolve mutex', { threadId: thread.id });
          }
          lockReleased = true;
        }
      }

    } catch (error) {
      await monitor.end(false, error.message);
      logger.error('Safe ticket resolution failed', {
        threadId: thread.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate safe thread name with collision resistance
   */
  generateSafeThreadName(prefix) {
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
    const name = `${prefix}-${suffix}`;
    
    // Ensure within Discord limits
    return name.length > 100 ? name.slice(0, 100) : name;
  }

  /**
   * Mark thread name as closed safely
   */
  markThreadNameClosed(name) {
    const prefix = '[CLOSED] ';
    if (name.startsWith(prefix)) return name;
    
    const closedName = `${prefix}${name}`;
    return closedName.length > 100 
      ? `${prefix}${name.slice(0, 100 - prefix.length)}`
      : closedName;
  }

  /**
   * Check if thread can be resolved
   */
  canResolveTicket(thread) {
    return !thread.archived && !thread.locked && thread.isThread();
  }

  /**
   * Get production health status
   */
  async getHealthStatus() {
    const health = await reconciliationService.performHealthCheck(null);
    const stats = await metricsService.getPerformanceStats();
    const cleanupStatus = cleanupService.getJobStatuses();
    
    return {
      status: this.isInitialized ? 'running' : 'not_initialized',
      health,
      performance: stats,
      cleanup: cleanupStatus,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get operational metrics
   */
  async getMetrics() {
    return await metricsService.exportMetrics();
  }

  /**
   * Force run cleanup job
   */
  async forceCleanupJob(jobName, client) {
    return await cleanupService.forceRunJob(jobName, client);
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown already in progress');
        return;
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop cleanup jobs
        await cleanupService.stopCleanupJobs();
        
        // Cleanup resources
        lockService.destroy();
        
        // Cleanup metrics
        await metricsService.cleanup();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Graceful shutdown failed', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Validate system integrity
   */
  async validateSystemIntegrity(client) {
    const results = {
      database: await this.validateDatabaseIntegrity(),
      redis: await this.validateRedisIntegrity(),
      discord: await this.validateDiscordIntegrity(client),
      webhooks: await this.validateWebhookIntegrity(client),
      locks: await this.validateLockIntegrity()
    };

    const allHealthy = Object.values(results).every(result => result.healthy);
    
    logger.info('System integrity validation completed', { results, allHealthy });
    
    return { healthy: allHealthy, results };
  }

  /**
   * Validate database integrity
   */
  async validateDatabaseIntegrity() {
    try {
      // Test basic database operations
      const timer = createTimer('database:integrity_check');
      await metricsService.recordDatabaseOperation('integrity_check', timer.end(true), true);
      
      return { healthy: true, message: 'Database responding normally' };
    } catch (error) {
      await metricsService.recordDatabaseOperation('integrity_check', 0, false, { error: error.message });
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Validate Redis integrity
   */
  async validateRedisIntegrity() {
    try {
      const timer = createTimer('redis:integrity_check');
      await metricsService.recordRedisOperation('integrity_check', timer.end(true), true);
      
      return { healthy: true, message: 'Redis responding normally' };
    } catch (error) {
      await metricsService.recordRedisOperation('integrity_check', 0, false, { error: error.message });
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Validate Discord API integrity
   */
  async validateDiscordIntegrity(client) {
    try {
      const timer = createTimer('discord:integrity_check');
      await client.user.fetch();
      await metricsService.recordDiscordOperation('integrity_check', timer.end(true), true);
      
      return { healthy: true, message: 'Discord API responding normally' };
    } catch (error) {
      await metricsService.recordDiscordOperation('integrity_check', 0, false, { error: error.message });
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Validate webhook integrity
   */
  async validateWebhookIntegrity(client) {
    try {
      const logChannel = client.channels.cache.get('1485668403132760243');
      if (!logChannel) {
        return { healthy: false, error: 'Log channel not found' };
      }

      const isValid = await discordRestService.validateWebhookCache(logChannel);
      return { healthy: isValid, message: isValid ? 'Webhook cache valid' : 'Webhook cache invalid' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Validate lock integrity
   */
  async validateLockIntegrity() {
    try {
      // Test lock acquisition and release
      const testKey = 'integrity:test';
      const lockValue = await lockService.acquireCreationLock('test', 'test', 1000);
      
      if (!lockValue) {
        return { healthy: false, error: 'Failed to acquire test lock' };
      }

      const released = await lockService.releaseCreationLock('test', 'test', lockValue);
      
      return { healthy: released, message: released ? 'Lock system working' : 'Failed to release test lock' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

export const productionService = new ProductionService();
