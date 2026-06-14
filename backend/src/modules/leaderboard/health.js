import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, HEARTBEAT_TTL_MS } from './redis-keys.js';

export async function getLeaderboardHealth(redis) {
  const result = {
    redis: 'unknown',
    sync_worker: 'unknown',
    reset_worker: 'unknown',
    last_sync: null,
    last_leaderboard_update: null,
    last_reset: null,
    sync_staleness_ms: null,
    leaderboard_staleness_ms: null,
    reset_staleness_ms: null,
    instance_id: process.env.HOSTNAME || process.pid.toString()
  };

  const rawClient = redis.getClient();

  if (!rawClient) {
    result.redis = 'not_initialized';
  } else {
    try {
      const ping = await rawClient.ping();
      result.redis = ping === 'PONG' ? 'ok' : 'unreachable';
    } catch (err) {
      logger.debug({ err }, 'Health check: Redis ping failed');
      result.redis = 'down';
    }
  }

  try {
    const heartbeat = await redis.get(REDIS_KEYS.workerHeartbeat);
    if (heartbeat) {
      const heartbeatTime = new Date(heartbeat).getTime();
      if (isNaN(heartbeatTime)) {
        logger.debug({ heartbeat }, 'Health check: invalid heartbeat timestamp');
        result.sync_worker = 'unknown';
      } else {
        const age = Date.now() - heartbeatTime;
        result.sync_staleness_ms = age;

        if (age < 0) {
          result.sync_worker = 'unknown';
        } else if (age < HEARTBEAT_TTL_MS) {
          const ratio = age / HEARTBEAT_TTL_MS;
          result.sync_worker = ratio < 0.5 ? 'healthy' : 'degraded';
        } else {
          result.sync_worker = 'unhealthy';
        }
      }
    } else {
      result.sync_worker = 'unknown';
    }
  } catch (err) {
    logger.debug({ err }, 'Health check: heartbeat fetch failed');
    result.sync_worker = 'unknown';
  }

  try {
    const resetHeartbeat = await redis.get(REDIS_KEYS.workerResetHeartbeat);
    if (resetHeartbeat) {
      const resetTime = new Date(resetHeartbeat).getTime();
      if (isNaN(resetTime)) {
        result.reset_worker = 'unknown';
      } else {
        const age = Date.now() - resetTime;
        result.reset_staleness_ms = age;
        if (age < 0) {
          result.reset_worker = 'unknown';
        } else if (age < HEARTBEAT_TTL_MS) {
          const ratio = age / HEARTBEAT_TTL_MS;
          result.reset_worker = ratio < 0.5 ? 'healthy' : 'degraded';
        } else {
          result.reset_worker = 'unhealthy';
        }
      }
    } else {
      result.reset_worker = 'unknown';
    }
  } catch (err) {
    logger.debug({ err }, 'Health check: reset heartbeat fetch failed');
    result.reset_worker = 'unknown';
  }

  try {
    result.last_sync = await redis.get(REDIS_KEYS.workerLastSync);
    if (result.last_sync) {
      const t = new Date(result.last_sync).getTime();
      if (!isNaN(t)) {
        result.last_sync_age_ms = Date.now() - t;
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Health check: last_sync fetch failed');
  }

  try {
    result.last_leaderboard_update = await redis.get(REDIS_KEYS.workerLastLeaderboardUpdate);
    if (result.last_leaderboard_update) {
      const t = new Date(result.last_leaderboard_update).getTime();
      if (!isNaN(t)) {
        result.leaderboard_staleness_ms = Date.now() - t;
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Health check: last_leaderboard_update fetch failed');
  }

  try {
    result.last_reset = await redis.get(REDIS_KEYS.workerResetHeartbeat);
  } catch (err) {
    logger.debug({ err }, 'Health check: last_reset fetch failed');
  }

  return result;
}
