import crypto from 'node:crypto';
import { Redis } from 'ioredis';
import type { RedisClient } from '../types/index.js';
import { env } from './config/env.js';
import { metrics } from '../observability/metrics.js';
import { logger } from '../utils/logger.js';

interface SetOptions {
  PX?: number;
  EX?: number;
  NX?: boolean;
  XX?: boolean;
  KEEPTTL?: boolean;
  GET?: boolean;
}

class RedisClientImpl implements RedisClient {
  private client: Redis | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private lastErrorLog = 0;
  private errorLogInterval = 30000;
  private isConnecting = false;
  private connectPromise: Promise<boolean> | null = null;
  connectionFailed = false;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private skippedOps = 0;

  private logError(message: string, error: unknown): void {
    const now = Date.now();
    if (now - this.lastErrorLog > this.errorLogInterval) {
      logger.error({ err: error }, message);
      this.lastErrorLog = now;
    }
  }

  async connect(): Promise<boolean> {
    if (this.isConnecting) {
      logger.info('Redis connection already in progress...');
      return this.connectPromise ?? this.isConnected;
    }

    if (this.client?.status === 'ready' || this.client?.status === 'connect') {
      return true;
    }

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

  private async _connect(): Promise<boolean> {
    try {
      const isRenderRedis = env.redis.url?.includes('rediss://') ||
        env.redis.url?.includes('render.com') ||
        env.redis.url?.startsWith('redis://default:');

      logger.info(`Connecting to Redis${isRenderRedis ? ' (Render Redis with TLS)' : ''}...`);

      this.client = new Redis(env.redis.url || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => {
          if (times > this.maxReconnectAttempts) {
            logger.warn(`Redis max reconnection attempts (${this.maxReconnectAttempts}) reached. Entering degraded mode — will retry periodically.`);
            this.connectionFailed = true;
            this.scheduleRecovery();
            return null;
          }
          const delay = Math.min(Math.pow(2, times) * 1000, 10000);
          if (times <= 3) {
            logger.info(`Redis reconnecting in ${delay}ms (attempt ${times}/${this.maxReconnectAttempts})`);
          }
          return delay;
        },
        connectTimeout: 10000,
        keepAlive: 30000,
        lazyConnect: true,
        ...(isRenderRedis && {
          tls: {},
          rejectUnauthorized: true
        })
      });

      this.client.on('error', (err: Error) => {
        if (err.message?.includes('Socket') || err.message?.includes('ECONNREFUSED')) {
          this.logError('Redis connection error:', err);
        } else {
          logger.error('Redis error:', err.message);
        }
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
      });

      this.client.on('ready', () => {
        logger.info('Redis Client Ready');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionFailed = false;
        this.skippedOps = 0;
        if (this.recoveryTimer) {
          clearTimeout(this.recoveryTimer);
          this.recoveryTimer = null;
        }
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        if (this.reconnectAttempts <= 3) {
          logger.info(`Redis reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        } else if (this.reconnectAttempts === this.maxReconnectAttempts) {
          logger.info('Redis max reconnections reached, giving up');
        }
      });

      this.client.on('end', () => {
        logger.info('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();

      this.isConnected = true;
      return true;
    } catch (error) {
      this.logError('Failed to connect to Redis:', error);
      this.isConnected = false;
      this.connectionFailed = true;
      return false;
    }
  }

  private scheduleRecovery(): void {
    if (this.recoveryTimer) return;
    this.recoveryTimer = setTimeout(async () => {
      this.recoveryTimer = null;
      this.connectionFailed = false;
      logger.info('Attempting Redis recovery...');
      const ok = await this.connect();
      if (!ok) {
        this.scheduleRecovery();
      } else {
        this.skippedOps = 0;
      }
    }, 60000);
  }

  isReady(): boolean {
    const ready = this.isConnected && this.client !== null && (this.client.status === 'ready' || this.client.status === 'connect');
    if (!ready) {
      this.skippedOps++;
      if (this.skippedOps % 100 === 0) {
        logger.warn(`Redis not ready — ${this.skippedOps} operations skipped since last failure`);
      }
    }
    return ready;
  }

  isEnabled(): boolean {
    return !this.connectionFailed;
  }

  async setex(key: string, ttl: number, value: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping setex operation');
      return false;
    }

    try {
      await this.client!.setex(key, ttl, String(value));
      return true;
    } catch (error) {
      logger.error(`Failed to setex key ${key}:`, error);
      return false;
    }
  }

  async acquireLock(key: string, ttl: number, value: string | null = null): Promise<string | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lock acquisition');
      return null;
    }

    const lockValue = value || crypto.randomUUID();

    try {
      const result = await this.client!.set(key, lockValue, 'PX', ttl, 'NX');
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      logger.error(`Failed to acquire lock for key ${key}:`, error);
      return null;
    }
  }

  async releaseLock(key: string, value: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lock release');
      return false;
    }

    try {
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client!.eval(luaScript, 1, key, value);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to release lock for key ${key}:`, error);
      return false;
    }
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping mget operation');
      return [];
    }

    try {
      const result = await this.client!.mget(keys);
      return result || [];
    } catch (error) {
      logger.error('Failed to mget keys:', error);
      return [];
    }
  }

  async keys(pattern: string, count = 100): Promise<string[]> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping keys operation');
      return [];
    }

    try {
      const result: string[] = [];
      let cursor = '0';
      do {
        const reply = await this.client!.scan(cursor, 'MATCH', pattern, 'COUNT', count);
        cursor = reply[0];
        result.push(...reply[1]);
      } while (cursor !== '0');
      return result;
    } catch (error) {
      logger.error(`Failed to scan keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  async set(key: string, value: string, opts: SetOptions = {}): Promise<string | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping set operation');
      return null;
    }

    try {
      const flags: (string | number)[] = [];
      if (opts.PX !== undefined) flags.push('PX', opts.PX);
      if (opts.EX !== undefined) flags.push('EX', opts.EX);
      if (opts.NX) flags.push('NX');
      if (opts.XX) flags.push('XX');
      if (opts.KEEPTTL) flags.push('KEEPTTL');
      if (opts.GET) flags.push('GET');

      const result = await metrics.time('redis_latency_ms', { operation: 'set' }, () =>
        (this.client!.set as any)(key, String(value), ...flags) as Promise<string | null>
      );
      return result;
    } catch (error) {
      logger.error(`Failed to set key ${key}:`, error);
      return null;
    }
  }

  async append(key: string, value: string): Promise<number> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping append operation');
      return 0;
    }

    try {
      const result = await this.client!.append(key, String(value));
      return result || 0;
    } catch (error) {
      logger.error(`Failed to append to key ${key}:`, error);
      return 0;
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping incr operation');
      return null;
    }

    try {
      return await metrics.time('redis_latency_ms', { operation: 'incr' }, () =>
        this.client!.incr(key)
      );
    } catch (error) {
      logger.error(`Failed to incr key ${key}:`, error);
      return null;
    }
  }

  async incrBy(key: string, amount = 1): Promise<number | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping incrby operation');
      return null;
    }

    try {
      return await metrics.time('redis_latency_ms', { operation: 'incrBy' }, () =>
        this.client!.incrby(key, amount)
      );
    } catch (error) {
      logger.error(`Failed to incrby key ${key}:`, error);
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping get operation');
      return null;
    }

    try {
      return await metrics.time('redis_latency_ms', { operation: 'get' }, () => this.client!.get(key));
    } catch (error) {
      logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping delete operation');
      return 0;
    }

    try {
      if (keys.length === 0) return 0;
      const result = await metrics.time('redis_latency_ms', { operation: 'del' }, () =>
        this.client!.del(keys)
      );
      return result || 0;
    } catch (error) {
      logger.error('Failed to delete keys:', error);
      return 0;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping delete operation');
      return false;
    }

    try {
      const result = await this.client!.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Failed to delete key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  async eval(script: string, opts: { keys: string[]; arguments: string[] }): Promise<any> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping eval operation');
      return null;
    }

    try {
      const evalKeys = opts.keys && opts.keys.length > 0 ? opts.keys : [];
      const evalArgs = opts.arguments && opts.arguments.length > 0 ? opts.arguments : [];

      const result = await metrics.time('redis_latency_ms', { operation: 'eval' }, () =>
        this.client!.eval(script, evalKeys.length, ...evalKeys, ...evalArgs)
      );
      return result;
    } catch (error) {
      logger.error('Failed to execute Lua script:', error);
      return null;
    }
  }

  async setNX(key: string, value: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping setnx operation');
      return false;
    }

    try {
      const result = await this.client!.setnx(key, String(value));
      return result === 1;
    } catch (error) {
      logger.error(`Failed to setnx key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping expire operation');
      return false;
    }

    try {
      const result = await this.client!.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to set expiration on key ${key}:`, error);
      return false;
    }
  }

  async setWithTTL(key: string, value: string, ttl: number): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping set operation');
      return false;
    }

    try {
      await this.client!.setex(key, Math.ceil(ttl / 1000), String(value));
      return true;
    } catch (error) {
      logger.error(`Failed to set key ${key}:`, error);
      return false;
    }
  }

  async pipeline(pipelineFn: (multi: any) => void): Promise<any[]> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping pipeline operation');
      return [];
    }

    try {
      const pipeline = this.client!.pipeline();
      pipelineFn(pipeline);
      const results = await metrics.time('redis_latency_ms', { operation: 'pipeline' }, () =>
        pipeline.exec()
      );
      return results || [];
    } catch (error) {
      logger.error('Failed to execute Redis pipeline:', error);
      return [];
    }
  }

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lrange operation');
      return [];
    }

    try {
      const result = await this.client!.lrange(key, start, stop);
      return result || [];
    } catch (error) {
      logger.error(`Failed to lrange key ${key}:`, error);
      return [];
    }
  }

  async lPop(key: string): Promise<string | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lpop operation');
      return null;
    }

    try {
      const result = await this.client!.lpop(key);
      return result;
    } catch (error) {
      logger.error(`Failed to lpop key ${key}:`, error);
      return null;
    }
  }

  async lLen(key: string): Promise<number> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping llen operation');
      return 0;
    }

    try {
      const result = await this.client!.llen(key);
      return result || 0;
    } catch (error) {
      logger.error(`Failed to llen key ${key}:`, error);
      return 0;
    }
  }

  async lPush(key: string, value: string): Promise<number> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping lpush operation');
      return 0;
    }

    try {
      const result = await this.client!.lpush(key, value);
      return result;
    } catch (error) {
      logger.error(`Failed to lpush to key ${key}:`, error);
      return 0;
    }
  }

  async lTrim(key: string, start: number, stop: number): Promise<string | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping ltrim operation');
      return null;
    }

    try {
      const result = await this.client!.ltrim(key, start, stop);
      return result;
    } catch (error) {
      logger.error(`Failed to ltrim key ${key}:`, error);
      return null;
    }
  }

  async hSet(key: string, values: Record<string, string | number>): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping hset operation');
      return false;
    }

    try {
      await this.client!.hset(key, values);
      return true;
    } catch (error) {
      logger.error(`Failed to set hash ${key}:`, error);
      return false;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string> | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping hgetall operation');
      return null;
    }

    try {
      const result = await this.client!.hgetall(key);
      return result || null;
    } catch (error) {
      logger.error(`Failed to get hash ${key}:`, error);
      return null;
    }
  }

  async hDel(key: string, field: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping hdel operation');
      return false;
    }

    try {
      const result = await this.client!.hdel(key, field);
      return result > 0;
    } catch (error) {
      logger.error(`Failed to delete hash field ${key}.${field}:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
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

  getClient(): Redis | null {
    return this.isReady() ? this.client : null;
  }
}

export const redisClient = new RedisClientImpl();

export default redisClient;
