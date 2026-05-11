import { createClient } from 'redis';
import { env } from './config/env.js';

/**
 * Redis client wrapper for distributed caching and locking
 * Provides connection management, error handling, and utility methods
 */

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      this.client = createClient({
        url: env.redis.url || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              console.error('Redis max reconnection attempts reached');
              return new Error('Redis connection failed');
            }
            const delay = Math.min(retries * this.reconnectDelay, 30000);
            console.log(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          },
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        console.log('Redis Client Ready');
      });

      this.client.on('end', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady() {
    return this.isConnected && this.client && this.client.isOpen;
  }

  /**
   * Acquire a distributed lock with timeout
   * @param {string} key - Lock key
   * @param {number} ttl - Time to live in milliseconds
   * @param {string} value - Optional lock value (defaults to random UUID)
   * @returns {Promise<string|null>} Lock value if acquired, null otherwise
   */
  async acquireLock(key, ttl, value = null) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping lock acquisition');
      return null;
    }

    const lockValue = value || crypto.randomUUID();
    const ttlSeconds = Math.ceil(ttl / 1000);
    
    try {
      const result = await this.client.set(key, lockValue, {
        PX: ttl,
        NX: true // Only set if key doesn't exist
      });
      
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      console.error(`Failed to acquire lock for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Release a distributed lock
   * @param {string} key - Lock key
   * @param {string} value - Lock value to verify ownership
   * @returns {Promise<boolean>} True if lock was released
   */
  async releaseLock(key, value) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping lock release');
      return false;
    }

    try {
      // Lua script to safely delete lock only if value matches
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(luaScript, {
        keys: [key],
        arguments: [value]
      });
      
      return result === 1;
    } catch (error) {
      console.error(`Failed to release lock for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set a key with expiration
   * @param {string} key - Redis key
   * @param {string} value - Value to store
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<boolean>} True if successful
   */
  async setWithTTL(key, value, ttl) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping set operation');
      return false;
    }

    try {
      await this.client.setEx(key, Math.ceil(ttl / 1000), value);
      return true;
    } catch (error) {
      console.error(`Failed to set key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get a value by key
   * @param {string} key - Redis key
   * @returns {Promise<string|null>} Value or null if not found
   */
  async get(key) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping get operation');
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key
   * @param {string} key - Redis key
   * @returns {Promise<boolean>} True if key was deleted
   */
  async delete(key) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping delete operation');
      return false;
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Failed to delete key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if a key exists
   * @param {string} key - Redis key
   * @returns {Promise<boolean>} True if key exists
   */
  async exists(key) {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   * @param {string} key - Redis key
   * @param {number} amount - Amount to increment (default 1)
   * @returns {Promise<number|null>} New value or null on error
   */
  async increment(key, amount = 1) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping increment operation');
      return null;
    }

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      console.error(`Failed to increment key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set multiple values in a hash
   * @param {string} key - Hash key
   * @param {Object} values - Object with key-value pairs
   * @returns {Promise<boolean>} True if successful
   */
  async hSet(key, values) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping hset operation');
      return false;
    }

    try {
      await this.client.hSet(key, values);
      return true;
    } catch (error) {
      console.error(`Failed to set hash ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all values from a hash
   * @param {string} key - Hash key
   * @returns {Promise<Object|null>} Hash object or null on error
   */
  async hGetAll(key) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping hgetall operation');
      return null;
    }

    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      console.error(`Failed to get hash ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a hash field
   * @param {string} key - Hash key
   * @param {string} field - Field to delete
   * @returns {Promise<boolean>} True if field was deleted
   */
  async hDel(key, field) {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping hdel operation');
      return false;
    }

    try {
      const result = await this.client.hDel(key, field);
      return result > 0;
    } catch (error) {
      console.error(`Failed to delete hash field ${key}.${field}:`, error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('Redis Client Disconnected');
      } catch (error) {
        console.error('Error disconnecting Redis:', error);
      }
    }
    this.isConnected = false;
  }

  /**
   * Get Redis client instance for advanced operations
   * @returns {import('redis').RedisClientType|null}
   */
  getClient() {
    return this.isReady() ? this.client : null;
  }
}

// Create singleton instance
export const redisClient = new RedisClient();

// Initialize connection when module is imported
redisClient.connect().catch((error) => {
  console.error('Failed to initialize Redis connection:', error);
});

export default redisClient;
