import type { FastifyRequest, FastifyReply } from 'fastify';
import { redisClient } from '../../core/redis.js';
import { logger } from '../../utils/logger.js';

const IDEMPOTENCY_TTL_SECONDS = 86_400;

const HEADERS_TO_CACHE = [
  'x-request-id',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-expose-headers',
  'vary',
  'x-idempotent'
];

export async function idempotencyPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;

  const key = (request.headers['idempotency-key'] as string)?.trim();
  if (!key || key.length < 8 || key.length > 256) return;
  if (!redisClient.isReady()) return;

  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
  const redisKey = `idempotency:${safeKey}`;

  try {
    const existing = await redisClient.get(redisKey);
    if (existing !== null) {
      try {
        const cached = JSON.parse(existing);
        logger.debug('Idempotency hit', { key: safeKey });
        reply.status(cached.status).headers(cached.headers ?? {}).send(cached.body);
        return;
      } catch {
        await redisClient.del(redisKey);
      }
    }

    (request as any).idempotencyKey = safeKey;
    (request as any).idempotencyRedisKey = redisKey;
  } catch (error) {
    logger.warn('Idempotency middleware error:', error);
  }
}

export async function idempotencyOnSend(request: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<void> {
  const safeKey = (request as any).idempotencyKey;
  if (!safeKey) return;

  if (reply.statusCode >= 200 && reply.statusCode < 300) {
    const redisKey = (request as any).idempotencyRedisKey;
    const cachedHeaders: Record<string, string> = { 'x-idempotent': 'true' };
    for (const header of HEADERS_TO_CACHE) {
      const value = reply.getHeader(header);
      if (value !== undefined && value !== null) {
        cachedHeaders[header] = String(value);
      }
    }

    const data = JSON.stringify({
      status: reply.statusCode,
      headers: cachedHeaders,
      body: payload,
    });
    redisClient.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, data).catch(() => {});
  }
}
