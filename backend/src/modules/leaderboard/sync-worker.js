import { env } from '../../core/config/env.js';
import { redisClient } from '../../core/redis.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, activeUsersSyncingKey, messagesKey } from './redis-keys.js';

const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false }
});

const SYNC_INTERVAL_MS = (Number(process.env.LEADERBOARD_SYNC_INTERVAL_MINUTES) || 10) * 60 * 1000;
const LUA_GET_AND_RESET = `
  local count = redis.call('GET', KEYS[1])
  if count then
    redis.call('SET', KEYS[1], 0)
    return count
  end
  return 0
`;

async function processBucket(rawClient, bucket) {
  const syncingKey = activeUsersSyncingKey(bucket);

  let syncingMembers;
  try {
    syncingMembers = await rawClient.sMembers(syncingKey);
  } catch {
    return [];
  }

  if (syncingMembers.length === 0) return [];

  const results = [];
  for (const userId of syncingMembers) {
    const key = messagesKey(bucket, userId);
    try {
      const count = await rawClient.eval(LUA_GET_AND_RESET, { keys: [key] });
      results.push({ userId, count: Number(count) });
    } catch (err) {
      logger.error({ err, userId, bucket }, 'Failed to get/reset counter');
    }
  }
  return results;
}

async function performSync() {
  const rawClient = redisClient.getClient();
  if (!rawClient) {
    logger.warn('Redis not available, skipping sync');
    return;
  }

  const allUserCounts = new Map();

  for (const bucket of BUCKETS) {
    const syncingKey = activeUsersSyncingKey(bucket);
    const activeKey = activeUsersKey(bucket);

    try {
      await rawClient.rename(activeKey, syncingKey);
    } catch (err) {
      if (err.message !== 'ERR no such key') {
        logger.error({ err, bucket }, 'Failed to rename active_users set');
      }
    }

    const results = await processBucket(rawClient, bucket);
    for (const { userId, count } of results) {
      if (!allUserCounts.has(userId)) {
        allUserCounts.set(userId, { p_user_id: userId, p_daily_count: 0, p_weekly_count: 0, p_monthly_count: 0 });
      }
      allUserCounts.get(userId)[`p_${bucket}_count`] = count;
    }
  }

  if (allUserCounts.size === 0) {
    await redisClient.set(REDIS_KEYS.workerLastSync, new Date().toISOString());
    await redisClient.setex(REDIS_KEYS.workerHeartbeat, 1200, new Date().toISOString());
    return;
  }

  const updates = [...allUserCounts.values()];

  const { error } = await supabase.rpc('bulk_increment_counts', { updates });

  if (error) {
    logger.error({ err: error, updateCount: updates.length }, 'Supabase bulk_increment failed, restoring counts');

    for (const update of updates) {
      const restorePipelineItems = [];
      for (const bucket of BUCKETS) {
        const count = update[`p_${bucket}_count`];
        if (count > 0) {
          restorePipelineItems.push({ key: messagesKey(bucket, update.p_user_id), amount: count });
        }
      }
      if (restorePipelineItems.length > 0) {
        await redisClient.pipeline((p) => {
          for (const item of restorePipelineItems) {
            p.incrBy(item.key, item.amount);
          }
        });
      }

      for (const bucket of BUCKETS) {
        const count = update[`p_${bucket}_count`];
        if (count > 0) {
          try {
            await rawClient.sAdd(activeUsersKey(bucket), update.p_user_id);
          } catch {}
        }
      }
    }
    return;
  }

  for (const bucket of BUCKETS) {
    const syncingKey = activeUsersSyncingKey(bucket);
    try {
      await rawClient.del(syncingKey);
    } catch {}
  }

  await redisClient.set(REDIS_KEYS.workerLastSync, new Date().toISOString());
  await redisClient.setex(REDIS_KEYS.workerHeartbeat, 1200, new Date().toISOString());

  logger.info({ userCount: updates.length }, 'Sync completed');
}

async function handleLeftoverSyncingSets() {
  const rawClient = redisClient.getClient();
  if (!rawClient) return;

  for (const bucket of BUCKETS) {
    const syncingKey = activeUsersSyncingKey(bucket);
    try {
      const members = await rawClient.sMembers(syncingKey);
      if (members.length > 0) {
        logger.warn({ bucket, count: members.length }, 'Found leftover syncing set from previous run');
      }
    } catch {
      // Key doesn't exist, that's fine
    }
  }
}

async function main() {
  logger.info('Leaderboard sync worker starting...');

  await redisClient.connect();

  if (!redisClient.isReady()) {
    logger.error('Redis connection failed, exiting');
    process.exit(1);
  }

  await handleLeftoverSyncingSets();

  await performSync();

  setInterval(() => {
    performSync().catch((err) => logger.error({ err }, 'Sync cycle failed'));
  }, SYNC_INTERVAL_MS);

  logger.info({ syncIntervalMs: SYNC_INTERVAL_MS }, 'Leaderboard sync worker ready');
}

main().catch((err) => {
  logger.error({ err }, 'Sync worker fatal error');
  process.exit(1);
});
