import { redisClient } from '../../core/redis.js';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, activeUsersSyncingKey, messagesKey } from './redis-keys.js';

function getNextDailyReset() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 1, 0));
  return next.getTime() - now.getTime();
}

function getNextWeeklyReset() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 0, 1, 0));
  return next.getTime() - now.getTime();
}

function getNextMonthlyReset() {
  const now = new Date();
  const nextMonth = now.getUTCMonth() + 1;
  const nextYear = nextMonth > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;
  const next = new Date(Date.UTC(nextYear, nextMonthIndex, 1, 0, 1, 0));
  return next.getTime() - now.getTime();
}

async function resetBucket(bucket) {
  const rawClient = redisClient.getClient();
  if (!rawClient) return 0;

  const activeKey = activeUsersKey(bucket);
  const syncingKey = activeUsersSyncingKey(bucket);

  let members;
  try {
    members = await rawClient.sMembers(activeKey);
  } catch {
    members = [];
  }

  let syncingMembers;
  try {
    syncingMembers = await rawClient.sMembers(syncingKey);
  } catch {
    syncingMembers = [];
  }

  const allUsers = [...new Set([...members, ...syncingMembers])];

  if (allUsers.length > 0) {
    const pipeline = rawClient.multi();
    for (const userId of allUsers) {
      pipeline.del(messagesKey(bucket, userId));
    }
    pipeline.del(activeKey);
    pipeline.del(syncingKey);
    await pipeline.exec();
  }

  logger.info({ bucket, userCount: allUsers.length }, `${bucket.charAt(0).toUpperCase() + bucket.slice(1)} reset complete`);
  return allUsers.length;
}

function scheduleResets() {
  const scheduleNext = (getDelay, label, bucket) => {
    const delay = getDelay();
    logger.info({ delayMs: delay, label }, `Scheduled next ${label} reset`);
    setTimeout(async () => {
      try {
        await resetBucket(bucket);
      } catch (err) {
        logger.error({ err, bucket }, `${label} reset failed`);
      }
      scheduleNext(getDelay, label, bucket);
    }, delay);
  };

  scheduleNext(getNextDailyReset, 'daily', 'daily');
  scheduleNext(getNextWeeklyReset, 'weekly', 'weekly');
  scheduleNext(getNextMonthlyReset, 'monthly', 'monthly');
}

async function main() {
  logger.info('Leaderboard reset worker starting...');

  await redisClient.connect();

  if (!redisClient.isReady()) {
    logger.error('Redis connection failed, exiting');
    process.exit(1);
  }

  scheduleResets();
  logger.info('Leaderboard reset worker ready');
}

main().catch((err) => {
  logger.error({ err }, 'Reset worker fatal error');
  process.exit(1);
});
