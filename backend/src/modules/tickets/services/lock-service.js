/**
 * Lock service - distributed locking using Redis
 * Prevents race conditions and duplicate operations
 */

import logger from './logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { TICKET_CREATION_LOCK_MS } from '../utils/constants.js';
import { isValidDiscordId } from '../utils/validators.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';

export class LockService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Acquires a creation lock for a user
   * Prevents multiple tickets from being created simultaneously
   */
  async acquireCreationLock(userId) {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.creatingLock(userId);
      const lockTTL = Math.ceil(TICKET_CREATION_LOCK_MS / 1000);

      const result = await this.redis.setex(key, lockTTL, Date.now().toString());

      if (!result) {
        throw new Error('Failed to set lock');
      }

      logger.debug('Creation lock acquired', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to acquire creation lock', { userId, error: error.message });
      throw new DatabaseError('Failed to acquire creation lock', { userId });
    }
  }

  /**
   * Checks if a user has an active creation lock
   */
  async hasCreationLock(userId) {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.creatingLock(userId);
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check creation lock', { userId, error: error.message });
      throw new DatabaseError('Failed to check creation lock', { userId });
    }
  }

  /**
   * Releases a creation lock
   */
  async releaseCreationLock(userId) {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.creatingLock(userId);
      await this.redis.del(key);
      logger.debug('Creation lock released', { userId });
    } catch (error) {
      logger.error('Failed to release creation lock', { userId, error: error.message });
      throw new DatabaseError('Failed to release creation lock', { userId });
    }
  }

  /**
   * Acquires a distributed lock for a resource
   * Returns a lock ID that must be used to release the lock
   */
  async acquireLock(resourceName, ttlSeconds = 30) {
    try {
      const key = REDIS_KEYS.lock(resourceName);
      const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const result = await this.redis.set(
        key,
        lockId,
        'PX',
        ttlSeconds * 1000,
        'NX'
      );

      if (!result) {
        return null; // Lock already exists
      }

      logger.debug('Lock acquired', { resourceName, lockId });
      return lockId;
    } catch (error) {
      logger.error('Failed to acquire lock', { resourceName, error: error.message });
      throw new DatabaseError('Failed to acquire lock', { resourceName });
    }
  }

  /**
   * Releases a distributed lock if the lock ID matches
   */
  async releaseLock(resourceName, lockId) {
    try {
      const key = REDIS_KEYS.lock(resourceName);
      
      // Use Lua script to ensure atomic compare-and-delete
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, key, lockId);

      if (result === 1) {
        logger.debug('Lock released', { resourceName, lockId });
        return true;
      }

      logger.warn('Lock mismatch or already expired', { resourceName, lockId });
      return false;
    } catch (error) {
      logger.error('Failed to release lock', { resourceName, error: error.message });
      throw new DatabaseError('Failed to release lock', { resourceName });
    }
  }

  /**
   * Wrapper function that acquires a lock, runs a function, then releases
   */
  async withLock(resourceName, fn, ttlSeconds = 30) {
    const lockId = await this.acquireLock(resourceName, ttlSeconds);

    if (!lockId) {
      throw new Error(`Failed to acquire lock for ${resourceName}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(resourceName, lockId);
    }
  }
}

export default LockService;
