import { REDIS_KEYS } from './redis-keys.js';

export async function getLeaderboardHealth(redis) {
  const result = {
    redis: 'down',
    sync_worker: 'unknown',
    last_sync: null,
    last_leaderboard_update: null
  };

  try {
    const ping = await redis.getClient()?.ping();
    result.redis = ping === 'PONG' ? 'ok' : 'down';
  } catch {
    result.redis = 'down';
  }

  try {
    const heartbeat = await redis.get(REDIS_KEYS.workerHeartbeat);
    if (heartbeat) {
      const heartbeatTime = new Date(heartbeat).getTime();
      const age = Date.now() - heartbeatTime;
      result.sync_worker = age < 20 * 60 * 1000 ? 'healthy' : 'unhealthy';
    } else {
      result.sync_worker = 'unknown';
    }
  } catch {
    result.sync_worker = 'unknown';
  }

  try {
    result.last_sync = await redis.get(REDIS_KEYS.workerLastSync);
  } catch {}
  try {
    result.last_leaderboard_update = await redis.get(REDIS_KEYS.workerLastLeaderboardUpdate);
  } catch {}

  return result;
}
