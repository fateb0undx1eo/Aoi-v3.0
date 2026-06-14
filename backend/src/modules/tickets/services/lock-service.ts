import logger from './logging-service.js';
import { REDIS_KEYS, KEY_TTLS } from '../utils/redis-keys.js';
import { TICKET_CREATION_LOCK_MS } from '../utils/constants.js';
import { isValidDiscordId } from '../utils/validators.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';
import type { RedisClient } from '../../../types/index.js';

export class LockService {
  private redis: RedisClient;
  private localLocks: Map<string, number> = new Map();

  constructor(redis: RedisClient) {
    this.redis = redis;
    this.cleanupLocalLocks();
  }

  private cleanupLocalLocks(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.localLocks.entries()) {
      if (expiresAt <= now) {
        this.localLocks.delete(key);
      }
    }
  }

  async acquireCreationLock(userId: string): Promise<boolean> {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.creatingLock(userId);
      const expiresAt = Date.now() + TICKET_CREATION_LOCK_MS;

      if (!this.redis.isReady?.()) {
        this.cleanupLocalLocks();
        if (this.localLocks.has(key)) {
          return false;
        }
        this.localLocks.set(key, expiresAt);
        logger.warn('Using local ticket creation lock because Redis is unavailable', { userId });
        return true;
      }

      const result = await (this.redis as any).set(
        key,
        expiresAt.toString(),
        'PX',
        TICKET_CREATION_LOCK_MS,
        'NX'
      );

      const acquired = result === 'OK';
      logger.debug('Creation lock checked', { userId, acquired });
      return acquired;
    } catch (error) {
      logger.error('Failed to acquire creation lock', { userId, error: (error as Error).message });
      throw new DatabaseError('Failed to acquire creation lock', { userId });
    }
  }

  async hasCreationLock(userId: string): Promise<boolean> {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.creatingLock(userId);
      if (!this.redis.isReady?.()) {
        this.cleanupLocalLocks();
        return this.localLocks.has(key);
      }

      const exists = await this.redis.exists(key);
      return exists === true;
    } catch (error) {
      logger.error('Failed to check creation lock', { userId, error: (error as Error).message });
      throw new DatabaseError('Failed to check creation lock', { userId });
    }
  }

  async releaseCreationLock(userId: string): Promise<void> {
    if (!isValidDiscordId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    try {
      const key = REDIS_KEYS.creatingLock(userId);
      this.localLocks.delete(key);
      await this.redis.del(key);
      logger.debug('Creation lock released', { userId });
    } catch (error) {
      logger.error('Failed to release creation lock', { userId, error: (error as Error).message });
      throw new DatabaseError('Failed to release creation lock', { userId });
    }
  }

  async acquireLock(resourceName: string, ttlSeconds: number = 30): Promise<string | null> {
    try {
      const key = REDIS_KEYS.lock(resourceName);
      const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const result = await (this.redis as any).set(
        key,
        lockId,
        'PX',
        ttlSeconds * 1000,
        'NX'
      );

      if (!result) {
        return null;
      }

      logger.debug('Lock acquired', { resourceName, lockId });
      return lockId;
    } catch (error) {
      logger.error('Failed to acquire lock', { resourceName, error: (error as Error).message });
      throw new DatabaseError('Failed to acquire lock', { resourceName });
    }
  }

  async releaseLock(resourceName: string, lockId: string): Promise<boolean> {
    try {
      const key = REDIS_KEYS.lock(resourceName);

      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await (this.redis as any).eval(script, { keys: [key], arguments: [lockId] });

      if (result === 1) {
        logger.debug('Lock released', { resourceName, lockId });
        return true;
      }

      logger.warn('Lock mismatch or already expired', { resourceName, lockId });
      return false;
    } catch (error) {
      logger.error('Failed to release lock', { resourceName, error: (error as Error).message });
      throw new DatabaseError('Failed to release lock', { resourceName });
    }
  }

  async withLock<T>(resourceName: string, fn: () => Promise<T>, ttlSeconds: number = 30): Promise<T> {
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
