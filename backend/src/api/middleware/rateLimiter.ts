import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../utils/logger.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, CLEANUP_INTERVAL);

export function rateLimiter(opts: {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
} = {}) {
  const { windowMs = 60_000, maxRequests = 60, keyPrefix = 'global' } = opts;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = (request as any).user?.id || request.ip || 'unknown';
    const key = `${keyPrefix}:${userId}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    reply.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > maxRequests) {
      logger.warn(`Rate limit exceeded for ${key}`);
      reply.status(429).send({
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      });
      return;
    }
  };
}
