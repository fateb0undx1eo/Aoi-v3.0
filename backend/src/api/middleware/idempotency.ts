import type { Request, Response, NextFunction } from 'express';
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

export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }

  const key = (req.headers['idempotency-key'] as string)?.trim();
  if (!key || key.length < 8 || key.length > 256) {
    next();
    return;
  }

  if (!redisClient.isReady()) {
    next();
    return;
  }

  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
  const redisKey = `idempotency:${safeKey}`;

  try {
    const existing = await redisClient.get(redisKey);
    if (existing !== null) {
      try {
        const cached = JSON.parse(existing);
        logger.debug('Idempotency hit', { key: safeKey });
        res.status(cached.status).set(cached.headers ?? {}).json(cached.body);
        return;
      } catch {
        await redisClient.del(redisKey);
      }
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any): Response {
      const cachedHeaders: Record<string, string> = { 'x-idempotent': 'true' };
      for (const header of HEADERS_TO_CACHE) {
        const value = res.getHeader(header);
        if (value !== undefined && value !== null) {
          cachedHeaders[header] = String(value);
        }
      }

      const payload = JSON.stringify({
        status: res.statusCode,
        headers: cachedHeaders,
        body,
      });
      redisClient.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, payload).catch(() => {});
      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.warn('Idempotency middleware error:', error);
    next();
  }
}
