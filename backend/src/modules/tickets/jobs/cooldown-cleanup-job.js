import { cooldownService } from '../services/cooldown-service.js';
import { cooldownRepository } from '../repositories/cooldown-repository.js';
import { loggingService } from '../services/logging-service.js';
import { metricsService } from '../services/metrics-service.js';
import { generateRedisKey } from '../utils/redis-keys.js';
import { redisClient } from '../../../../../core/redis.js';
import { 
  COOLDOWN_CLEANUP_INTERVAL,
  COOLDOWN_CLEANUP_BATCH_SIZE,
  REDIS_TTL
} from '../utils/constants.js';

/**
 * Enterprise-grade cooldown cleanup job
 * Manages cooldown expiration, cleanup, and optimization
 */

/**
 * Main cooldown cleanup job function
 * Runs periodically to clean up expired cooldowns and optimize storage
 */
export async function runCooldownCleanupJob() {
  const jobId = `cooldown_cleanup_${Date.now()}`;
  const context = {
    operation: 'cooldown_cleanup_job',
    jobId,
    startTime: new Date().toISOString()
  };

  const timer = metricsService.createTimer();

  try {
    await loggingService.info({
      operation: 'cooldown_cleanup_job_start',
      ...context,
      message: 'Starting cooldown cleanup job'
    });

    // Acquire job lock to prevent concurrent runs
    const lockKey = generateRedisKey('lock', 'cooldown_cleanup');
    const lockValue = await redisClient.acquireLock(lockKey, COOLDOWN_CLEANUP_INTERVAL);
    
    if (!lockValue) {
      await loggingService.warn({
        operation: 'cooldown_cleanup_job_skip',
        ...context,
        message: 'Cooldown cleanup job already running, skipping'
      });
      return;
    }

    try {
      let totalCleaned = 0;
      
      // Step 1: Clean up expired Redis cooldowns
      const redisCleaned = await cleanupExpiredRedisCooldowns(context);
      totalCleaned += redisCleaned;
      
      // Step 2: Clean up expired database cooldowns
      const dbCleaned = await cleanupExpiredDatabaseCooldowns(context);
      totalCleaned += dbCleaned;
      
      // Step 3: Sync Redis and database cooldowns
      const synced = await syncCooldownsBetweenStores(context);
      
      // Step 4: Optimize cooldown storage
      const optimized = await optimizeCooldownStorage(context);
      
      // Step 5: Cleanup orphaned cooldowns
      const orphanedCleaned = await cleanupOrphanedCooldowns(context);
      totalCleaned += orphanedCleaned;

      const duration = timer.stop();
      await metricsService.recordCooldownCleanupJob(duration, true, {
        jobId,
        totalCleaned,
        redisCleaned,
        dbCleaned,
        synced,
        optimized,
        orphanedCleaned
      });

      await loggingService.info({
        operation: 'cooldown_cleanup_job_complete',
        ...context,
        message: 'Cooldown cleanup job completed successfully',
        metadata: { 
          duration, 
          totalCleaned,
          redisCleaned,
          dbCleaned,
          synced,
          optimized,
          orphanedCleaned
        }
      });

    } finally {
      // Release job lock
      await redisClient.releaseLock(lockKey, lockValue);
    }

  } catch (error) {
    const duration = timer.stop();
    await metricsService.recordCooldownCleanupJob(duration, false, {
      jobId,
      error: error.message
    });

    await loggingService.error({
      operation: 'cooldown_cleanup_job_error',
      ...context,
      message: 'Cooldown cleanup job failed',
      metadata: { error: error.message, stack: error.stack }
    });
  }
}

/**
 * Clean up expired Redis cooldowns
 * @param {Object} context - Job context
 * @returns {number} Number of cooldowns cleaned
 */
async function cleanupExpiredRedisCooldowns(context) {
  let cleaned = 0;
  
  try {
    await loggingService.info({
      operation: 'cleanup_redis_cooldowns',
      ...context,
      message: 'Starting Redis cooldown cleanup'
    });

    // Get all cooldown keys in Redis
    const cooldownPattern = generateRedisKey('cooldown', '*');
    const keys = await redisClient.keys(cooldownPattern);
    
    if (keys.length === 0) {
      await loggingService.info({
        operation: 'cleanup_redis_cooldowns_empty',
        ...context,
        message: 'No Redis cooldowns found'
      });
      return cleaned;
    }

    // Process keys in batches
    for (let i = 0; i < keys.length; i += COOLDOWN_CLEANUP_BATCH_SIZE) {
      const batch = keys.slice(i, i + COOLDOWN_CLEANUP_BATCH_SIZE);
      
      for (const key of batch) {
        try {
          // Check if cooldown has expired
          const ttl = await redisClient.ttl(key);
          
          if (ttl === -1) {
            // Key exists but has no TTL, remove it
            await redisClient.del(key);
            cleaned++;
            
            await loggingService.debug({
              operation: 'cleanup_redis_cooldown_no_ttl',
              ...context,
              message: 'Removed Redis cooldown with no TTL',
              metadata: { key }
            });
          } else if (ttl === -2) {
            // Key doesn't exist, skip
            continue;
          } else if (ttl <= 0) {
            // Key has expired, remove it
            await redisClient.del(key);
            cleaned++;
            
            await loggingService.debug({
              operation: 'cleanup_redis_cooldown_expired',
              ...context,
              message: 'Removed expired Redis cooldown',
              metadata: { key, ttl }
            });
          }
        } catch (error) {
          await loggingService.warn({
            operation: 'cleanup_redis_cooldown_key_error',
            ...context,
            message: `Failed to process Redis cooldown key ${key}`,
            metadata: { key, error: error.message }
          });
        }
      }
    }

    await loggingService.info({
      operation: 'cleanup_redis_cooldowns_complete',
      ...context,
      message: 'Redis cooldown cleanup completed',
      metadata: { totalKeys: keys.length, cleaned }
    });

  } catch (error) {
    await loggingService.warn({
      operation: 'cleanup_redis_cooldowns_error',
      ...context,
      message: 'Failed to cleanup Redis cooldowns',
      metadata: { error: error.message }
    });
  }

  return cleaned;
}

/**
 * Clean up expired database cooldowns
 * @param {Object} context - Job context
 * @returns {number} Number of cooldowns cleaned
 */
async function cleanupExpiredDatabaseCooldowns(context) {
  let cleaned = 0;
  
  try {
    await loggingService.info({
      operation: 'cleanup_db_cooldowns',
      ...context,
      message: 'Starting database cooldown cleanup'
    });

    // Get expired cooldowns from database
    const expiredCooldowns = await cooldownRepository.findExpiredCooldowns();
    
    if (expiredCooldowns.length === 0) {
      await loggingService.info({
        operation: 'cleanup_db_cooldowns_empty',
        ...context,
        message: 'No expired database cooldowns found'
      });
      return cleaned;
    }

    // Clean up expired cooldowns
    for (const cooldown of expiredCooldowns) {
      try {
        // Remove from database
        await cooldownRepository.delete(cooldown.id);
        cleaned++;
        
        // Also remove from Redis if it exists
        const redisKey = generateRedisKey('cooldown', cooldown.guild_id, cooldown.user_id);
        await redisClient.del(redisKey).catch(() => null);
        
        await loggingService.debug({
          operation: 'cleanup_db_cooldown_removed',
          ...context,
          message: 'Removed expired database cooldown',
          metadata: { 
            cooldownId: cooldown.id,
            guildId: cooldown.guild_id,
            userId: cooldown.user_id 
          }
        });
      } catch (error) {
        await loggingService.warn({
          operation: 'cleanup_db_cooldown_remove_error',
          ...context,
          message: `Failed to remove database cooldown ${cooldown.id}`,
          metadata: { 
            cooldownId: cooldown.id,
            error: error.message 
          }
        });
      }
    }

    await loggingService.info({
      operation: 'cleanup_db_cooldowns_complete',
      ...context,
      message: 'Database cooldown cleanup completed',
      metadata: { totalExpired: expiredCooldowns.length, cleaned }
    });

  } catch (error) {
    await loggingService.warn({
      operation: 'cleanup_db_cooldowns_error',
      ...context,
      message: 'Failed to cleanup database cooldowns',
      metadata: { error: error.message }
    });
  }

  return cleaned;
}

/**
 * Sync cooldowns between Redis and database
 * @param {Object} context - Job context
 * @returns {number} Number of cooldowns synced
 */
async function syncCooldownsBetweenStores(context) {
  let synced = 0;
  
  try {
    await loggingService.info({
      operation: 'sync_cooldowns_stores',
      ...context,
      message: 'Starting cooldown store synchronization'
    });

    // Get all active cooldowns from database
    const dbCooldowns = await cooldownRepository.findActiveCooldowns();
    
    for (const dbCooldown of dbCooldowns) {
      try {
        const redisKey = generateRedisKey('cooldown', dbCooldown.guild_id, dbCooldown.user_id);
        const redisExists = await redisClient.exists(redisKey);
        
        if (!redisExists) {
          // Cooldown exists in database but not in Redis, restore it
          const expirationTime = new Date(dbCooldown.expires_at).getTime();
          const now = Date.now();
          const ttl = Math.max(0, Math.floor((expirationTime - now) / 1000));
          
          if (ttl > 0) {
            await redisClient.setex(redisKey, ttl, '1');
            synced++;
            
            await loggingService.debug({
              operation: 'sync_cooldown_to_redis',
              ...context,
              message: 'Restored cooldown to Redis',
              metadata: { 
                guildId: dbCooldown.guild_id,
                userId: dbCooldown.user_id,
                ttl 
              }
            });
          }
        }
      } catch (error) {
        await loggingService.warn({
          operation: 'sync_cooldown_error',
          ...context,
          message: `Failed to sync cooldown for user ${dbCooldown.user_id}`,
          metadata: { 
            guildId: dbCooldown.guild_id,
            userId: dbCooldown.user_id,
            error: error.message 
          }
        });
      }
    }

    await loggingService.info({
      operation: 'sync_cooldowns_stores_complete',
      ...context,
      message: 'Cooldown store synchronization completed',
      metadata: { totalDbCooldowns: dbCooldowns.length, synced }
    });

  } catch (error) {
    await loggingService.warn({
      operation: 'sync_cooldowns_stores_error',
      ...context,
      message: 'Failed to sync cooldown stores',
      metadata: { error: error.message }
    });
  }

  return synced;
}

/**
 * Optimize cooldown storage
 * @param {Object} context - Job context
 * @returns {number} Number of optimizations performed
 */
async function optimizeCooldownStorage(context) {
  let optimized = 0;
  
  try {
    await loggingService.info({
      operation: 'optimize_cooldown_storage',
      ...context,
      message: 'Starting cooldown storage optimization'
    });

    // Optimize Redis storage by checking for duplicate keys
    const cooldownPattern = generateRedisKey('cooldown', '*');
    const keys = await redisClient.keys(cooldownPattern);
    
    // Group keys by guild and user to find duplicates
    const keyGroups = {};
    
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 4) {
        const guildId = parts[2];
        const userId = parts[3];
        const groupKey = `${guildId}:${userId}`;
        
        if (!keyGroups[groupKey]) {
          keyGroups[groupKey] = [];
        }
        keyGroups[groupKey].push(key);
      }
    }
    
    // Remove duplicate keys, keeping the one with the longest TTL
    for (const [groupKey, duplicateKeys] of Object.entries(keyGroups)) {
      if (duplicateKeys.length > 1) {
        try {
          // Find the key with the longest TTL
          let bestKey = null;
          let bestTtl = -1;
          
          for (const key of duplicateKeys) {
            const ttl = await redisClient.ttl(key);
            if (ttl > bestTtl) {
              bestTtl = ttl;
              bestKey = key;
            }
          }
          
          // Remove all other keys
          for (const key of duplicateKeys) {
            if (key !== bestKey) {
              await redisClient.del(key);
              optimized++;
            }
          }
          
          await loggingService.debug({
            operation: 'optimize_cooldown_duplicates',
            ...context,
            message: 'Removed duplicate cooldown keys',
            metadata: { 
              groupKey,
              duplicateCount: duplicateKeys.length,
              keptKey: bestKey 
            }
          });
        } catch (error) {
          await loggingService.warn({
            operation: 'optimize_cooldown_duplicates_error',
            ...context,
            message: `Failed to optimize duplicate keys for ${groupKey}`,
            metadata: { groupKey, error: error.message }
          });
        }
      }
    }

    await loggingService.info({
      operation: 'optimize_cooldown_storage_complete',
      ...context,
      message: 'Cooldown storage optimization completed',
      metadata: { totalKeys: keys.length, optimized }
    });

  } catch (error) {
    await loggingService.warn({
      operation: 'optimize_cooldown_storage_error',
      ...context,
      message: 'Failed to optimize cooldown storage',
      metadata: { error: error.message }
    });
  }

  return optimized;
}

/**
 * Clean up orphaned cooldowns
 * @param {Object} context - Job context
 * @returns {number} Number of cooldowns cleaned
 */
async function cleanupOrphanedCooldowns(context) {
  let cleaned = 0;
  
  try {
    await loggingService.info({
      operation: 'cleanup_orphaned_cooldowns',
      ...context,
      message: 'Starting orphaned cooldown cleanup'
    });

    // Find cooldowns for users who are no longer in the guild
    const orphanedCooldowns = await cooldownRepository.findOrphanedCooldowns();
    
    for (const cooldown of orphanedCooldowns) {
      try {
        // Check if user is still in guild
        const userInGuild = await checkUserInGuild(cooldown.guild_id, cooldown.user_id);
        
        if (!userInGuild) {
          // Remove orphaned cooldown
          await cooldownRepository.delete(cooldown.id);
          
          // Also remove from Redis
          const redisKey = generateRedisKey('cooldown', cooldown.guild_id, cooldown.user_id);
          await redisClient.del(redisKey).catch(() => null);
          
          cleaned++;
          
          await loggingService.debug({
            operation: 'cleanup_orphaned_cooldown_removed',
            ...context,
            message: 'Removed orphaned cooldown',
            metadata: { 
              cooldownId: cooldown.id,
              guildId: cooldown.guild_id,
              userId: cooldown.user_id 
            }
          });
        }
      } catch (error) {
        await loggingService.warn({
          operation: 'cleanup_orphaned_cooldown_error',
          ...context,
          message: `Failed to check orphaned cooldown ${cooldown.id}`,
          metadata: { 
            cooldownId: cooldown.id,
            error: error.message 
          }
        });
      }
    }

    await loggingService.info({
      operation: 'cleanup_orphaned_cooldowns_complete',
      ...context,
      message: 'Orphaned cooldown cleanup completed',
      metadata: { totalOrphaned: orphanedCooldowns.length, cleaned }
    });

  } catch (error) {
    await loggingService.warn({
      operation: 'cleanup_orphaned_cooldowns_error',
      ...context,
      message: 'Failed to cleanup orphaned cooldowns',
      metadata: { error: error.message }
    });
  }

  return cleaned;
}

/**
 * Check if user is still in guild
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {boolean} Whether user is in guild
 */
async function checkUserInGuild(guildId, userId) {
  try {
    // This would be implemented based on your Discord client
    // For now, assume user is in guild
    return true;
  } catch (error) {
    // If we can't check, assume user is not in guild to be safe
    return false;
  }
}

/**
 * Get cooldown cleanup statistics
 * @returns {Object} Cleanup statistics
 */
export async function getCooldownCleanupStats() {
  try {
    const stats = {
      redisCooldowns: 0,
      databaseCooldowns: 0,
      expiredCooldowns: 0,
      orphanedCooldowns: 0
    };

    // Count Redis cooldowns
    const cooldownPattern = generateRedisKey('cooldown', '*');
    const redisKeys = await redisClient.keys(cooldownPattern);
    stats.redisCooldowns = redisKeys.length;

    // Count database cooldowns
    stats.databaseCooldowns = await cooldownRepository.countActiveCooldowns();
    stats.expiredCooldowns = await cooldownRepository.countExpiredCooldowns();
    stats.orphanedCooldowns = await cooldownRepository.countOrphanedCooldowns();

    return stats;
  } catch (error) {
    await loggingService.warn({
      operation: 'get_cooldown_cleanup_stats_error',
      message: 'Failed to get cooldown cleanup statistics',
      metadata: { error: error.message }
    });
    
    return {
      redisCooldowns: 0,
      databaseCooldowns: 0,
      expiredCooldowns: 0,
      orphanedCooldowns: 0,
      error: error.message
    };
  }
}

/**
 * Start cooldown cleanup job scheduler
 * @param {number} interval - Interval in milliseconds
 */
export function startCooldownCleanupScheduler(interval = COOLDOWN_CLEANUP_INTERVAL) {
  setInterval(async () => {
    await runCooldownCleanupJob();
  }, interval);
  
  loggingService.info({
    operation: 'cooldown_cleanup_scheduler_start',
    message: 'Cooldown cleanup job scheduler started',
    metadata: { interval }
  });
}
