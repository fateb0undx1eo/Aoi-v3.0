import { createClient } from 'redis';
import { env } from './config/env.js';
import { metrics } from '../observability/metrics.js';
import { logger } from '../utils/logger.js';

/**
 * Redis client wrapper for distributed caching and locking
 * Provides connection management, error handling, and utility methods
 * Gracefully degrades when Redis is unavailable
 */

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.lastErrorLog = 0;
    this.errorLogInterval = 30000; // Only log errors every 30 seconds
    this.isConnecting = false;
    this.connectPromise = null;
    this.connectionFailed = false;
  }

  /**
   * Rate-limited error logging to prevent spam
   */
  logError(message, error) {
    const now = Date.now();
    if (now - this.lastErrorLog > this.errorLogInterval) {
      logger.error({ err: error }, message);
      this.lastErrorLog = now;
    }
  }

  /**
   * Initialize Redis connection
   * Singleton pattern - only connects once
   */
  async connect() {
    // Prevent duplicate connection attempts
    if (this.isConnecting) {
      logger.info('Redis connection already in progress...');
      return this.connectPromise ?? this.isConnected;
    }

    // If already connected, don't reconnect
    if (this.client?.isOpen) {
      return true;
    }

    // If connection previously failed permanently, don't retry
    if (this.connectionFailed) {
      return false;
    }

    this.isConnecting = true;
    this.connectPromise = this._connect();

    try {
      return await this.connectPromise;
    } finally {
      this.isConnecting = false;
      this.connectPromise = null;
    }
  }

  async _connect() {
    try {
      const isRenderRedis = env.redis.url?.includes('rediss://') || 
                            env.redis.url?.includes('render.com') ||
                            env.redis.url?.startsWith('redis://default:'); // Render uses default username

      logger.info(`Connecting to Redis${isRenderRedis ? ' (Render Redis with TLS)' : ''}...`);

      this.client = createClient({
        url: env.redis.url || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              logger.error('❌ Redis max reconnection attempts reached. Disabling Redis features.');
              this.connectionFailed = true;
              return false; // Stop reconnecting
            }
            // Exponential backoff with max 10s delay
            const delay = Math.min(Math.pow(2, retries) * 1000, 10000);
            if (retries <= 3) {
              logger.info(`⏳ Redis reconnecting in ${delay}ms (attempt ${retries}/${this.maxReconnectAttempts})`);
            }
            return delay;
          },
          connectTimeout: 10000,
          keepAlive: 30000,
          // Enable TLS for Render Redis
          ...(isRenderRedis && {
            tls: true,
            rejectUnauthorized: false
          })
        }
      });

      // Track first connection vs reconnections
      let isFirstConnect = true;

      this.client.on('error', (err) => {
        // Rate-limit error logging - only log socket errors periodically
        if (err.message?.includes('Socket') || err.message?.includes('ECONNREFUSED')) {
          this.logError('Redis connection error:', err);
        } else {
          logger.error('Redis error:', err.message);
        }
      });

      this.client.on('connect', () => {
        if (isFirstConnect) {
          logger.info('✅ Redis Client Connected');
          isFirstConnect = false;
        }
      });

      this.client.on('ready', () => {
        logger.info('🚀 Redis Client Ready');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionFailed = false;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        // Only log first few reconnect attempts to prevent spam
        if (this.reconnectAttempts <= 3) {
          logger.info(`⏳ Redis reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        } else if (this.reconnectAttempts === this.maxReconnectAttempts) {
          logger.info('❌ Redis max reconnections reached, giving up');
        }
      });

      this.client.on('end', () => {
        logger.info('🔌 Redis Client Disconnected');
        this.isConnected = false;
      });

      // Only connect if not already connected
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      this.isConnected = true;
      return true;
    } catch (error) {
      this.logError('Failed to connect to Redis:', error);
      this.isConnected = false;
      this.connectionFailed = true;
      return false;
    }
  }

  /**
   * Check if Redis is connected and ready for operations
   */
  isReady() {
    return this.isConnected && this.client && this.client.isOpen;
  }

  /**
   * Check if Redis is enabled (not permanently failed)
   * Use this to decide whether to use Redis features or fall back
   */
  isEnabled() {
    return !this.connectionFailed;
  }

  /**
   * Set a value with expiration in seconds
   * Tickets module standard method
   * @param {string} key - Redis key
   * @param {number} ttl - Time to live in seconds
   * @param {string} value - Value to store
   * @returns {Promise<boolean>} True if successful
   */
  async setex(key, ttl, value) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping setex operation');
      return false;
    }

    try {
      await this.client.setEx(key, ttl, String(value));
      return true;
    } catch (error) {
      logger.error(`Failed to setex key ${key}:`, error);
      return false;
    }
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
      logger.warn('Redis not ready, skipping lock acquisition');
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
      logger.error(`Failed to acquire lock for key ${key}:`, error);
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
      logger.warn('Redis not ready, skipping lock release');
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
      logger.error(`Failed to release lock for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple values by keys
   * @param {...string} keys - Redis keys
   * @returns {Promise<Array>} Array of values
   */
  async mget(...keys) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping mget operation');
      return [];
    }

    try {
      const result = await this.client.mGet(keys);
      return result || [];
    } catch (error) {
      logger.error('Failed to mget keys:', error);
      return [];
    }
  }

  /**
   * Get keys matching a pattern
   * @param {string} pattern - Key pattern (e.g., "prefix:*")
   * @returns {Promise<Array>} Array of matching keys
   */
  async keys(pattern) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping keys operation');
      return [];
    }

    try {
      const result = await this.client.keys(pattern);
      return result || [];
    } catch (error) {
      logger.error(`Failed to get keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Set a value with options (NX, EX, PX, XX, etc.)
   * Supports multiple calling patterns:
   * - set(key, value, 'PX', ttl, 'NX')
   * - set(key, value, { PX: ttl, NX: true })
   * @param {string} key - Redis key
   * @param {string} value - Value to set
   * @param {string|Object} mode - Set mode string ('NX', 'XX', 'PX', 'EX') OR options object
   * @param {number} ttl - TTL value (if mode is a string like 'PX' or 'EX')
   * @param {string} flag - Additional flag ('NX' or 'XX') if mode is 'PX'/'EX'
   * @returns {Promise<string|null>} 'OK' if successful, null otherwise
   */
  async set(key, value, mode, ttl, flag) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping set operation');
      return null;
    }

    try {
      let opts = {};
      
      // Handle case where mode is an object
      if (typeof mode === 'object' && mode !== null) {
        opts = mode;
      } else if (typeof mode === 'string') {
        // Handle positional parameter style: set(key, value, 'PX', ms, 'NX')
        if (mode === 'PX' || mode === 'EX') {
          opts[mode] = ttl; // Set the TTL option
          if (flag === 'NX' || flag === 'XX') {
            opts[flag] = true; // Set the condition flag
          }
        } else if (mode === 'NX' || mode === 'XX') {
          // Handle if mode is just a flag
          opts[mode] = true;
          if (ttl === 'PX' || ttl === 'EX') {
            // Second parameter is actually a TTL mode
            opts[ttl] = flag;
          }
        }
      }
      
      const result = await metrics.time('redis_latency_ms', { operation: 'set' }, () =>
        this.client.set(key, String(value), opts)
      );
      return result;
    } catch (error) {
      logger.error(`Failed to set key ${key}:`, error);
      return null;
    }
  }

  /**
   * Append a value to a string
   * @param {string} key - Redis key
   * @param {string} value - Value to append
   * @returns {Promise<number>} New length of string
   */
  async append(key, value) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping append operation');
      return 0;
    }

    try {
      const result = await this.client.append(key, String(value));
      return result || 0;
    } catch (error) {
      logger.error(`Failed to append to key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Increment a counter (alias for incrBy with amount 1)
   * @param {string} key - Redis key
   * @returns {Promise<number|null>} New value or null on error
   */
  async incr(key) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping incr operation');
      return null;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Failed to incr key ${key}:`, error);
      return null;
    }
  }

  /**
   * Increment a counter by amount
   * @param {string} key - Redis key
   * @param {number} amount - Amount to increment (default 1)
   * @returns {Promise<number|null>} New value or null on error
   */
  async incrBy(key, amount = 1) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping incrby operation');
      return null;
    }

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      logger.error(`Failed to incrby key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get a value by key
   * @param {string} key - Redis key
   * @returns {Promise<string|null>} Value or null if not found
   */
  async get(key) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping get operation');
      return null;
    }

    try {
      return await metrics.time('redis_latency_ms', { operation: 'get' }, () => this.client.get(key));
    } catch (error) {
      logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete one or more keys
   * @param {...string} keys - Redis keys to delete
   * @returns {Promise<number>} Number of keys deleted
   */
  async del(...keys) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping delete operation');
      return 0;
    }

    try {
      if (keys.length === 0) return 0;
      const result = await this.client.del(keys);
      return result || 0;
    } catch (error) {
      logger.error(`Failed to delete keys:`, error);
      return 0;
    }
  }

  /**
   * Delete a single key (alias for del)
   * @param {string} key - Redis key
   * @returns {Promise<boolean>} True if key was deleted
   */
  async delete(key) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping delete operation');
      return false;
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Failed to delete key ${key}:`, error);
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
      logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Execute a Lua script
   * @param {string} script - Lua script code
   * @param {number} numKeys - Number of keys argument
   * @param {...*} args - Key and argument values
   * @returns {Promise<*>} Script result
   */
  async eval(script, numKeys, ...args) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping eval operation');
      return null;
    }

    try {
      const keys = args.slice(0, numKeys);
      const argv = args.slice(numKeys);
      
      const result = await this.client.eval(script, {
        keys: keys.length > 0 ? keys : undefined,
        arguments: argv.length > 0 ? argv : undefined
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to execute Lua script:', error);
      return null;
    }
  }

  /**
   * Set key value only if key doesn't exist
   * @param {string} key - Key to set
   * @param {string} value - Value to set
   * @returns {Promise<boolean>} True if key was set
   */
  async setNX(key, value) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping setnx operation');
      return false;
    }

    try {
      const result = await this.client.setNX(key, String(value));
      return result === true;
    } catch (error) {
      logger.error(`Failed to setnx key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time on key
   * @param {string} key - Key to set expiration on
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} True if successful
   */
  async expire(key, ttl) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping expire operation');
      return false;
    }

    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to set expiration on key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set a key with expiration (milliseconds version)
   * @param {string} key - Redis key
   * @param {string} value - Value to store
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<boolean>} True if successful
   */
  async setWithTTL(key, value, ttl) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping set operation');
      return false;
    }

    try {
      await this.client.setEx(key, Math.ceil(ttl / 1000), String(value));
      return true;
    } catch (error) {
      logger.error(`Failed to set key ${key}:`, error);
      return false;
    }
  }

  /**
   * Execute a pipeline of Redis commands
   * @param {Function} pipelineFn - Function that receives pipeline object
   * @returns {Promise<Array>} Array of results
   */
  async pipeline(pipelineFn) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping pipeline operation');
      return [];
    }

    try {
      const pipeline = this.client.multi();
      pipelineFn(pipeline);
      const results = await pipeline.exec();
      return results || [];
    } catch (error) {
      logger.error('Failed to execute Redis pipeline:', error);
      return [];
    }
  }

  /**
   * Get range of elements from list
   * @param {string} key - List key
   * @param {number} start - Start index (0 = first)
   * @param {number} stop - Stop index (-1 = last)
   * @returns {Promise<Array>} Array of values
   */
  async lRange(key, start, stop) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lrange operation');
      return [];
    }

    try {
      const result = await this.client.lRange(key, start, stop);
      return result || [];
    } catch (error) {
      logger.error(`Failed to lrange key ${key}:`, error);
      return [];
    }
  }

  /**
   * Remove and get first element of list
   * @param {string} key - List key
   * @returns {Promise<string|null>} First element or null
   */
  async lPop(key) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lpop operation');
      return null;
    }

    try {
      const result = await this.client.lPop(key);
      return result;
    } catch (error) {
      logger.error(`Failed to lpop key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get list length
   * @param {string} key - List key
   * @returns {Promise<number>} List length
   */
  async lLen(key) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping llen operation');
      return 0;
    }

    try {
      const result = await this.client.lLen(key);
      return result || 0;
    } catch (error) {
      logger.error(`Failed to llen key ${key}:`, error);
      return 0;
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
      logger.warn('Redis not ready, skipping hset operation');
      return false;
    }

    try {
      await this.client.hSet(key, values);
      return true;
    } catch (error) {
      logger.error(`Failed to set hash ${key}:`, error);
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
      logger.warn('Redis not ready, skipping hgetall operation');
      return null;
    }

    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error(`Failed to get hash ${key}:`, error);
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
      logger.warn('Redis not ready, skipping hdel operation');
      return false;
    }

    try {
      const result = await this.client.hDel(key, field);
      return result > 0;
    } catch (error) {
      logger.error(`Failed to delete hash field ${key}.${field}:`, error);
      return false;
    }
  }

  /**
   * Push value to the left of a list
   * @param {string} key - List key
   * @param {string} value - Value to push
   * @returns {Promise<number>} New list length
   */
  async lPush(key, value) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lpush operation');
      return 0;
    }

    try {
      const result = await this.client.lPush(key, value);
      return result;
    } catch (error) {
      logger.error(`Failed to lpush to key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Trim list to keep only specified range
   * @param {string} key - List key
   * @param {number} start - Start index
   * @param {number} stop - Stop index
   * @returns {Promise<string>} OK response
   */
  async lTrim(key, start, stop) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping ltrim operation');
      return null;
    }

    try {
      const result = await this.client.lTrim(key, start, stop);
      return result;
    } catch (error) {
      logger.error(`Failed to ltrim key ${key}:`, error);
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis Client Disconnected');
      } catch (error) {
        logger.error('Error disconnecting Redis:', error);
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

// Initialize connection when module is imported (non-blocking, singleton guarantee)
let initialized = false;

async function initializeRedis() {
  if (initialized) {
    logger.info('Redis already initialized, skipping...');
    return;
  }
  
  initialized = true;
  
  try {
    const connected = await redisClient.connect();
    if (connected) {
      logger.info('✅ Redis initialized successfully');
    } else if (redisClient.connectionFailed) {
      logger.info('⚠️ Redis unavailable - running without cache features');
    } else {
      logger.info('⏳ Redis connection pending...');
    }
  } catch (error) {
    logger.error('Redis initialization error:', error.message);
  }
}

// Start initialization

export default redisClient;
