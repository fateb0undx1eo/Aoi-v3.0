import { randomUUID } from 'node:crypto';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../observability/metrics.js';
import type { RedisClient } from '../../types/index.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  storedAt: number;
}

interface LayeredCacheOptions {
  defaultTtlMs: number;
  l1MaxSize: number;
  l1TtlMs: number;
}

export class LayeredCache {
  private l1 = new Map<string, CacheEntry<any>>();
  private options: LayeredCacheOptions;
  private redis: RedisClient | null;
  private hits = { l1: 0, l2: 0 };
  private misses = { l1: 0, l2: 0 };

  constructor(redis: RedisClient | null, options: Partial<LayeredCacheOptions> = {}) {
    this.redis = redis;
    this.options = {
      defaultTtlMs: options.defaultTtlMs ?? 60_000,
      l1MaxSize: options.l1MaxSize ?? 500,
      l1TtlMs: options.l1TtlMs ?? 30_000,
    };
  }

  private makeRedisKey(namespace: string, key: string): string {
    return `cache:${namespace}:${key}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return entry.expiresAt > 0 && Date.now() > entry.expiresAt;
  }

  private evictL1(): void {
    if (this.l1.size <= this.options.l1MaxSize) return;
    const oldest = this.l1.keys().next().value;
    if (oldest !== undefined) this.l1.delete(oldest);
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const l1Key = `${namespace}:${key}`;

    const l1Entry = this.l1.get(l1Key);
    if (l1Entry !== undefined) {
      if (!this.isExpired(l1Entry)) {
        this.l1.delete(l1Key);
        this.l1.set(l1Key, l1Entry);
        this.hits.l1++;
        metrics.increment('cache_hit', { layer: 'l1', namespace });
        return l1Entry.value as T;
      }
      this.l1.delete(l1Key);
    }

    this.misses.l1++;
    metrics.increment('cache_miss', { layer: 'l1', namespace });

    if (this.redis) {
      const redisKey = this.makeRedisKey(namespace, key);
      try {
        const raw = await this.redis.get(redisKey);
        if (raw !== null) {
          const parsed = JSON.parse(raw) as { value: T; ttl: number };
          this.hits.l2++;
          metrics.increment('cache_hit', { layer: 'l2', namespace });
          this.setL1(l1Key, parsed.value, parsed.ttl);
          return parsed.value;
        }
      } catch (error) {
        logger.warn(`L2 cache read failed for ${redisKey}:`, error);
      }
      this.misses.l2++;
      metrics.increment('cache_miss', { layer: 'l2', namespace });
    }

    return null;
  }

  async set<T>(namespace: string, key: string, value: T, ttlMs?: number): Promise<void> {
    const effectiveTtl = ttlMs ?? this.options.defaultTtlMs;
    const l1Key = `${namespace}:${key}`;

    this.setL1(l1Key, value, effectiveTtl);

    if (this.redis) {
      const redisKey = this.makeRedisKey(namespace, key);
      const payload = JSON.stringify({ value, ttl: effectiveTtl });
      try {
        await this.redis.setex(redisKey, Math.ceil(effectiveTtl / 1000), payload);
      } catch (error) {
        logger.warn(`L2 cache write failed for ${redisKey}:`, error);
      }
    }
  }

  private setL1<T>(key: string, value: T, ttlMs: number): void {
    this.l1.delete(key);
    this.l1.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
      storedAt: Date.now(),
    });
    this.evictL1();
  }

  async invalidate(namespace: string, key?: string): Promise<void> {
    if (key) {
      const l1Key = `${namespace}:${key}`;
      this.l1.delete(l1Key);
      if (this.redis) {
        const redisKey = this.makeRedisKey(namespace, key);
        try {
          await this.redis.del(redisKey).catch(() => {});
        } catch {}
      }
      metrics.increment('cache_invalidate', { namespace });
    } else {
      for (const k of this.l1.keys()) {
        if (k.startsWith(`${namespace}:`)) this.l1.delete(k);
      }
      if (this.redis) {
        try {
          const redisKeys = await this.redis.keys(`cache:${namespace}:*`);
          if (redisKeys.length > 0) await this.redis.del(...redisKeys);
        } catch {}
      }
      metrics.increment('cache_invalidate', { namespace, bulk: '1' });
    }
  }

  getStats() {
    return {
      l1Size: this.l1.size,
      l1MaxSize: this.options.l1MaxSize,
      hits: { ...this.hits },
      misses: { ...this.misses },
    };
  }
}

const debounceMap = new Map<string, { timer: ReturnType<typeof setTimeout>; lastCall: number }>();
const DEBOUNCE_CLEANUP_INTERVAL = 300_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of debounceMap) {
    if (now - entry.lastCall > DEBOUNCE_CLEANUP_INTERVAL) {
      clearTimeout(entry.timer);
      debounceMap.delete(key);
    }
  }
}, DEBOUNCE_CLEANUP_INTERVAL).unref();

const DEBOUNCE_MAX_SIZE = 1000;

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  waitMs: number,
  key?: string,
): (...args: Parameters<T>) => void {
  const id = key ?? randomUUID();
  return (...args: Parameters<T>) => {
    const existing = debounceMap.get(id);
    if (existing) clearTimeout(existing.timer);
    debounceMap.set(id, {
      timer: setTimeout(() => {
        debounceMap.delete(id);
        fn(...args);
      }, waitMs),
      lastCall: Date.now(),
    });

    // Evict oldest if over max size
    if (debounceMap.size > DEBOUNCE_MAX_SIZE) {
      const oldest = debounceMap.keys().next().value;
      if (oldest !== undefined && oldest !== id) {
        const oldEntry = debounceMap.get(oldest);
        if (oldEntry) clearTimeout(oldEntry.timer);
        debounceMap.delete(oldest);
      }
    }
  };
}

export function flushDebounce(key: string): void {
  const existing = debounceMap.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    debounceMap.delete(key);
  }
}
