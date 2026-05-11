import redisClient from '../../../core/redis.js';

export class LockService {
  constructor() {
    // In-memory fallback locks for graceful degradation
    this.inMemoryLocks = new Map();
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
    }, 30000); // Cleanup every 30 seconds
  }

  /**
   * Acquire a distributed lock for ticket creation
   * Falls back to in-memory lock if Redis is unavailable
   */
  async acquireCreationLock(guildId, userId, ttlMs = 8000) {
    const lockKey = `ticket:create:${guildId}:${userId}`;
    
    try {
      const lockValue = await redisClient.acquireLock(lockKey, ttlMs);
      if (lockValue) {
        return { type: 'redis', value: lockValue };
      }
    } catch (error) {
      console.warn(`Redis lock acquisition failed, falling back to in-memory: ${error.message}`);
    }

    // Fallback to in-memory lock for graceful degradation
    return this.acquireInMemoryLock(lockKey, ttlMs);
  }

  /**
   * Release creation lock
   */
  async releaseCreationLock(guildId, userId, lockValue) {
    const lockKey = `ticket:create:${guildId}:${userId}`;
    
    if (typeof lockValue === 'object' && lockValue.type === 'redis') {
      try {
        return await redisClient.releaseLock(lockKey, lockValue.value);
      } catch (error) {
        console.warn(`Failed to release Redis lock: ${error.message}`);
        return false;
      }
    }
    
    // Fallback to in-memory lock release
    return this.releaseInMemoryLock(lockKey, lockValue);
  }

  /**
   * Check if creation lock exists
   */
  async hasCreationLock(guildId, userId) {
    const lockKey = `ticket:create:${guildId}:${userId}`;
    
    try {
      return await redisClient.exists(lockKey);
    } catch (error) {
      console.warn(`Redis lock check failed, checking in-memory: ${error.message}`);
      return this.hasInMemoryLock(lockKey);
    }
  }

  /**
   * Acquire distributed mutex for ticket resolution
   */
  async acquireResolveMutex(threadId, ttlMs = 30000) {
    const lockKey = `ticket:closing:${threadId}`;
    
    try {
      const lockValue = await redisClient.acquireLock(lockKey, ttlMs);
      if (lockValue) {
        return { type: 'redis', value: lockValue };
      }
    } catch (error) {
      console.warn(`Redis resolve mutex acquisition failed, falling back to in-memory: ${error.message}`);
    }

    return this.acquireInMemoryLock(lockKey, ttlMs);
  }

  /**
   * Release resolve mutex
   */
  async releaseResolveMutex(threadId, lockValue) {
    const lockKey = `ticket:closing:${threadId}`;
    
    if (typeof lockValue === 'object' && lockValue.type === 'redis') {
      try {
        return await redisClient.releaseLock(lockKey, lockValue.value);
      } catch (error) {
        console.warn(`Failed to release Redis resolve mutex: ${error.message}`);
        return false;
      }
    }
    
    return this.releaseInMemoryLock(lockKey, lockValue);
  }

  /**
   * Check if resolve mutex is held
   */
  async hasResolveMutex(threadId) {
    const lockKey = `ticket:closing:${threadId}`;
    
    try {
      return await redisClient.exists(lockKey);
    } catch (error) {
      console.warn(`Redis resolve mutex check failed, checking in-memory: ${error.message}`);
      return this.hasInMemoryLock(lockKey);
    }
  }

  /**
   * Acquire lock for webhook operations
   */
  async acquireWebhookLock(channelId, ttlMs = 5000) {
    const lockKey = `ticket:webhook:${channelId}`;
    
    try {
      const lockValue = await redisClient.acquireLock(lockKey, ttlMs);
      if (lockValue) {
        return { type: 'redis', value: lockValue };
      }
    } catch (error) {
      console.warn(`Redis webhook lock acquisition failed, falling back to in-memory: ${error.message}`);
    }

    return this.acquireInMemoryLock(lockKey, ttlMs);
  }

  /**
   * Release webhook lock
   */
  async releaseWebhookLock(channelId, lockValue) {
    const lockKey = `ticket:webhook:${channelId}`;
    
    if (typeof lockValue === 'object' && lockValue.type === 'redis') {
      try {
        return await redisClient.releaseLock(lockKey, lockValue.value);
      } catch (error) {
        console.warn(`Failed to release Redis webhook lock: ${error.message}`);
        return false;
      }
    }
    
    return this.releaseInMemoryLock(lockKey, lockValue);
  }

  /**
   * In-memory lock acquisition for graceful degradation
   */
  acquireInMemoryLock(key, ttlMs) {
    const existing = this.inMemoryLocks.get(key);
    if (existing && existing.expires > Date.now()) {
      return null; // Lock already held
    }

    const lockValue = crypto.randomUUID();
    const expires = Date.now() + ttlMs;
    
    this.inMemoryLocks.set(key, { value: lockValue, expires });
    return { type: 'memory', value: lockValue };
  }

  /**
   * In-memory lock release
   */
  releaseInMemoryLock(key, lockValue) {
    const existing = this.inMemoryLocks.get(key);
    if (existing && existing.value === lockValue) {
      this.inMemoryLocks.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Check if in-memory lock exists
   */
  hasInMemoryLock(key) {
    const existing = this.inMemoryLocks.get(key);
    return existing && existing.expires > Date.now();
  }

  /**
   * Cleanup expired in-memory locks
   */
  cleanupExpiredLocks() {
    const now = Date.now();
    for (const [key, lock] of this.inMemoryLocks.entries()) {
      if (lock.expires <= now) {
        this.inMemoryLocks.delete(key);
      }
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.inMemoryLocks.clear();
  }
}

export const lockService = new LockService();
