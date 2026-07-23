import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, activeUsersSyncingKey, messagesKey, leaderboardMsgKey, HEARTBEAT_TTL_SECONDS } from './redis-keys.js';
import type { RedisClient } from '../../types/index.js';
import type { Client, Message } from 'discord.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export const LEADERBOARD_CHANNEL_ID = process.env.LEADERBOARD_CHANNEL_ID?.trim() || '';
export const UPDATE_INTERVAL_MS = (Number(process.env.LEADERBOARD_UPDATE_INTERVAL_MINUTES) || 60) * 60 * 1000;
export const SYNC_INTERVAL_MS = (Number(process.env.LEADERBOARD_SYNC_INTERVAL_MINUTES) || 10) * 60 * 1000;
export const EXCLUDED_CATEGORY_IDS = (process.env.LEADERBOARD_EXCLUDED_CATEGORIES || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

export interface UpdateEntry {
  p_user_id: string;
  p_daily_count: number;
  p_weekly_count: number;
  p_monthly_count: number;
}

export interface SyncResult {
  userId: string;
  count: number;
}

export const LUA_SYNC_BUCKET = `
  if redis.call('EXISTS', KEYS[2]) == 1 then
    local leftovers = redis.call('SMEMBERS', KEYS[2])
    if #leftovers > 0 then
      redis.call('SADD', KEYS[1], unpack(leftovers))
    end
    redis.call('DEL', KEYS[2])
  end
  if redis.call('EXISTS', KEYS[1]) == 0 then return {} end
  redis.call('RENAME', KEYS[1], KEYS[2])
  local members = redis.call('SMEMBERS', KEYS[2])
  if #members == 0 then return {} end
  local prefix = ARGV[1]
  local result = {}
  for i, userId in ipairs(members) do
    local key = prefix .. userId
    local count = redis.call('GET', key)
    if count then
      redis.call('SET', key, 0)
      result[#result + 1] = userId
      result[#result + 1] = count
    end
  end
  return result
`;

export function parseSyncResults(raw: any[], bucket: string): SyncResult[] {
  const results: SyncResult[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const userId = String(raw[i]);
    const count = Number(raw[i + 1]);
    if (userId && count > 0) {
      results.push({ userId, count });
    }
  }
  logger.debug({ bucket, userCount: results.length }, 'Sync bucket processed');
  return results;
}

export async function performSync(redis: RedisClient, supabase: SupabaseClient): Promise<void> {
  const lock = await redis.acquireLock('leaderboard:maintenance', 60000);
  if (!lock) {
    logger.debug('Maintenance lock held (sync or reset in progress), skipping');
    return;
  }
  try {
    await doSync(redis, supabase);
  } finally {
    await redis.releaseLock('leaderboard:maintenance', lock);
  }
}

export async function doSync(redis: RedisClient, supabase: SupabaseClient): Promise<void> {
  const rawClient = redis.getClient();
  if (!rawClient) return;

  const allUserCounts = new Map<string, UpdateEntry>();

  for (const bucket of BUCKETS) {
    const prefix = `messages:${bucket}:`;
    let raw: any;
    try {
      const evalKeys = [activeUsersKey(bucket), activeUsersSyncingKey(bucket)];
      const evalArgs = [prefix];
      raw = await rawClient.eval(LUA_SYNC_BUCKET, evalKeys.length, ...evalKeys, ...evalArgs);
    } catch (err) {
      logger.error({ err, bucket }, 'Sync bucket Lua script failed');
      return;
    }
    if (!Array.isArray(raw) || raw.length === 0) continue;

    const bucketResults = parseSyncResults(raw, bucket);
    for (const { userId, count } of bucketResults) {
      if (!allUserCounts.has(userId)) {
        allUserCounts.set(userId, { p_user_id: userId, p_daily_count: 0, p_weekly_count: 0, p_monthly_count: 0 });
      }
      const entry = allUserCounts.get(userId)!;
      (entry as any)[`p_${bucket}_count`] = count;
    }
  }

  if (allUserCounts.size === 0) {
    await redis.set(REDIS_KEYS.workerLastSync, new Date().toISOString());
    await redis.setex(REDIS_KEYS.workerHeartbeat, HEARTBEAT_TTL_SECONDS, new Date().toISOString());
    return;
  }

  const updates = [...allUserCounts.values()];
  const { error, status, statusText } = await supabase.rpc('bulk_increment_counts', { updates });

  if (error) {
    logger.error({
      err: error, errCode: error.code, errHint: error.hint, errMessage: error.message,
      status, statusText, count: updates.length, sample: updates.slice(0, 3)
    }, 'Supabase bulk_increment failed, restoring counts');

    const restorePipeline = rawClient.multi();
    for (const update of updates) {
      for (const bucket of BUCKETS) {
        const count = Number((update as any)[`p_${bucket}_count`]);
        if (count > 0) {
          restorePipeline.incrby(messagesKey(bucket, update.p_user_id), count);
          restorePipeline.sadd(activeUsersKey(bucket), update.p_user_id);
        }
      }
    }
    try {
      await restorePipeline.exec();
    } catch (err) {
      logger.error({ err, count: updates.length }, 'Bulk restore pipeline failed');
    }
    return;
  }

  for (const bucket of BUCKETS) {
    try {
      await rawClient.del(activeUsersSyncingKey(bucket));
    } catch (err) {
      logger.debug({ err, bucket }, 'Failed to clean up syncing set');
    }
  }

  await redis.set(REDIS_KEYS.workerLastSync, new Date().toISOString());
  await redis.setex(REDIS_KEYS.workerHeartbeat, HEARTBEAT_TTL_SECONDS, new Date().toISOString());
  logger.info({ userCount: updates.length }, 'Sync cycle completed');
}

export async function resetBucket(redis: RedisClient, bucket: string): Promise<number> {
  const lock = await redis.acquireLock('leaderboard:maintenance', 120000);
  if (!lock) {
    logger.debug('Maintenance lock held, skipping reset');
    return 0;
  }
  try {
    return await doResetBucket(redis, bucket);
  } finally {
    await redis.releaseLock('leaderboard:maintenance', lock);
  }
}

export async function doResetBucket(redis: RedisClient, bucket: string): Promise<number> {
  const rawClient = redis.getClient();
  if (!rawClient) return 0;

  let members: string[] = [];
  try {
    members = [...new Set([
      ...(await rawClient.smembers(activeUsersKey(bucket))),
      ...(await rawClient.smembers(activeUsersSyncingKey(bucket)))
    ])];
  } catch (err) {
    logger.warn({ err, bucket }, 'Failed to fetch members for reset');
  }

  if (members.length > 0) {
    const pipeline = rawClient.multi();
    for (const userId of members) pipeline.del(messagesKey(bucket, userId));
    pipeline.del(activeUsersKey(bucket));
    pipeline.del(activeUsersSyncingKey(bucket));
    try {
      await pipeline.exec();
    } catch (err) {
      logger.error({ err, bucket }, 'Reset pipeline failed');
      return 0;
    }
  }

  await redis.setex(REDIS_KEYS.workerResetHeartbeat, HEARTBEAT_TTL_SECONDS, new Date().toISOString());
  logger.info({ bucket, userCount: members.length }, `${bucket.charAt(0).toUpperCase() + bucket.slice(1)} reset complete`);
  return members.length;
}

export function onMessage(redis: RedisClient, message: Message): void {
  if (message.author?.bot) return;
  if (!message.guild) return;
  if ('parentId' in message.channel && message.channel.parentId && EXCLUDED_CATEGORY_IDS.includes(message.channel.parentId)) return;

  const trimmed = message.content.trim();
  if (trimmed.length < 2) return;
  if (/^(.)\1{9,}$/.test(trimmed)) return;
  if (new Set(trimmed).size / trimmed.length < 0.1) return;

  const rawClient = redis.getClient();
  if (!rawClient) {
    logger.debug('Redis client not available, message not counted');
    return;
  }

  const userId = message.author.id;
  const dedupKey = `leaderboard:dedup:${userId}`;

  rawClient.get(dedupKey)
    .then((lastContent: string | null) => {
      if (lastContent === trimmed) {
        logger.debug({ userId, content: trimmed.slice(0, 50) }, 'Duplicate message skipped');
        return;
      }
      return rawClient.setex(dedupKey, 60, trimmed)
        .then(() => {
          rawClient.multi()
            .incr(messagesKey('daily', userId))
            .incr(messagesKey('weekly', userId))
            .incr(messagesKey('monthly', userId))
            .sadd(activeUsersKey('daily'), userId)
            .sadd(activeUsersKey('weekly'), userId)
            .sadd(activeUsersKey('monthly'), userId)
            .exec()
            .then(() => { logger.debug({ userId, content: trimmed.slice(0, 50) }, 'Message counted'); })
            .catch((err: any) => logger.warn({ err }, 'Leaderboard count pipeline failed'));
        });
    })
    .catch((err: any) => logger.warn({ err }, 'Leaderboard dedup check failed'));
}

export async function validateRpcContract(supabase: SupabaseClient): Promise<boolean> {
  for (const bucket of BUCKETS) {
    try {
      const { error } = await supabase.rpc(`get_leaderboard_${bucket}`, { p_limit: 0, p_offset: 0 });
      if (error) {
        logger.error({ rpc: `get_leaderboard_${bucket}`, err: error }, 'Leaderboard RPC validation failed');
        return false;
      }
    } catch (err) {
      logger.error({ rpc: `get_leaderboard_${bucket}`, err }, 'Leaderboard RPC validation threw');
      return false;
    }
  }
  try {
    const { error } = await supabase.rpc('bulk_increment_counts', { updates: [] });
    if (error) {
      logger.error({ rpc: 'bulk_increment_counts', err: error }, 'Leaderboard bulk_increment RPC validation failed');
      return false;
    }
  } catch (err) {
    logger.error({ rpc: 'bulk_increment_counts', err }, 'Leaderboard bulk_increment RPC validation threw');
    return false;
  }
  logger.info('Leaderboard Supabase RPC contract validated');
  return true;
}

export async function recoverSyncingSets(redis: RedisClient): Promise<void> {
  const rawClient = redis.getClient();
  if (!rawClient) return;

  for (const bucket of BUCKETS) {
    const syncingKey = activeUsersSyncingKey(bucket);
    const activeKey = activeUsersKey(bucket);
    try {
      const count = await rawClient.scard(syncingKey);
      if (count > 0) {
        logger.warn({ bucket, count }, 'Found leftover syncing set from previous crash');
        const members = await rawClient.smembers(syncingKey);
        if (members.length > 0) {
          await rawClient.sadd(activeKey, members);
        }
        await rawClient.del(syncingKey);
      }
    } catch (err) {
      logger.error({ err, bucket }, 'Failed to recover syncing set');
    }
  }
}

export async function bootstrap(redis: RedisClient, discordClient: Client, supabase: SupabaseClient): Promise<void> {
  await recoverSyncingSets(redis);
  const rpcOk = await validateRpcContract(supabase);
  if (!rpcOk) {
    logger.warn('Leaderboard RPC contract invalid');
  }

  const envChannelId = LEADERBOARD_CHANNEL_ID;
  const redisChannelId = await redis.get(REDIS_KEYS.leaderboardChannel);
  const channelId = envChannelId || redisChannelId;

  if (!channelId) {
    logger.info('Leaderboard not configured, skipping startup');
    return;
  }

  if (envChannelId && envChannelId !== redisChannelId) {
    await redis.set(REDIS_KEYS.leaderboardChannel, envChannelId);
    logger.info({ channelId: envChannelId }, 'Leaderboard channel set from env');
  }

  const guild = discordClient.guilds.cache.first();
  if (!guild) {
    logger.warn('No guild available for leaderboard startup');
    return;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) {
    logger.warn({ channelId }, 'Leaderboard channel not accessible on startup');
    return;
  }

  for (const key of ['leaderboard:msg:header', ...BUCKETS.map((b) => `leaderboard:msg:${b}`)]) {
    const msgId = await redis.get(key);
    if (msgId) {
      try {
        await channel.messages.fetch(msgId);
      } catch {
        logger.warn({ key, msgId }, 'Stored message deleted, will recreate on update');
        await redis.del(key).catch(() => {});
      }
    }
  }

  const { updateLeaderboard } = await import('./leaderboard-updater.js');
  updateLeaderboard(redis, discordClient, supabase).catch((err) => logger.warn({ err }, 'Startup leaderboard update failed'));

  const h = await redis.get('leaderboard:msg:header') || 'none';
  const d = await redis.get(leaderboardMsgKey('daily')) || 'none';
  const w = await redis.get(leaderboardMsgKey('weekly')) || 'none';
  const m = await redis.get(leaderboardMsgKey('monthly')) || 'none';
  logger.info(`Leaderboard ready. Header: ${h}, Daily: ${d}, Weekly: ${w}, Monthly: ${m}`);
}
