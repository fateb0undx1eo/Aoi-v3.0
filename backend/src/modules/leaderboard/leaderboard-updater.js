import { MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS } from './redis-keys.js';

const TITLES = {
  daily: 'CHAT LEADERBOARD DAILY',
  weekly: 'CHAT LEADERBOARD WEEKLY',
  monthly: 'CHAT LEADERBOARD MONTHLY'
};

function getNextHourUnix() {
  const now = Date.now();
  return Math.floor(Math.ceil(now / 3600000) * 3600000 / 1000);
}

function getResetUnix(bucket) {
  const now = new Date();
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  switch (bucket) {
    case 'daily':
      return Math.floor((utc + 86400000) / 1000);
    case 'weekly': {
      const daysUntilMonday = now.getUTCDay() === 0 ? 1 : 8 - now.getUTCDay();
      return Math.floor((utc + daysUntilMonday * 86400000) / 1000);
    }
    case 'monthly': {
      const nextMonth = now.getUTCMonth() + 1;
      const nextYear = nextMonth > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
      const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;
      return Math.floor(Date.UTC(nextYear, nextMonthIndex, 1) / 1000);
    }
    default:
      return 0;
  }
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

function buildLeaderboardContainer(bucket, entries) {
  const lines = [`# ${TITLES[bucket]}`];

  if (entries.length === 0) {
    lines.push('_No messages recorded yet._');
  } else {
    for (let i = 0; i < entries.length; i++) {
      lines.push(`**${i + 1}.** <@${entries[i][0]}>  **${formatNumber(entries[i][1])}** messages`);
    }
  }

  lines.push(`Updates <t:${getNextHourUnix()}:R>`);
  lines.push(`Resets <t:${getResetUnix(bucket)}:R>`);

  return {
    type: 17,
    components: lines.map((line) => ({ type: 10, content: line }))
  };
}

export async function updateLeaderboard(redis, discordClient, supabase) {
  const lock = await redis.acquireLock('leaderboard:update:lock', 120000);
  if (!lock) {
    logger.debug('Leaderboard update lock held by another instance, skipping');
    return;
  }
  try {
    await doUpdate(redis, discordClient, supabase);
  } finally {
    await redis.releaseLock('leaderboard:update:lock', lock);
  }
}

async function doUpdate(redis, discordClient, supabase) {
  const channelId = await redis.get(REDIS_KEYS.leaderboardChannel);
  if (!channelId) {
    logger.warn('Leaderboard channel not configured');
    return;
  }

  const channel = await discordClient.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    logger.warn({ channelId }, 'Leaderboard channel not found or not text-based');
    return;
  }

  for (const bucket of BUCKETS) {
    await updateSingleLeaderboard(bucket, redis, supabase, channel);
  }

  await redis.set(REDIS_KEYS.workerLastLeaderboardUpdate, new Date().toISOString());
  logger.info('All leaderboards updated');
}

async function updateSingleLeaderboard(bucket, redis, supabase, channel) {
  let rows = [];
  try {
    const { data, error } = await supabase.rpc(`get_leaderboard_${bucket}`, { p_limit: 10, p_offset: 0 });
    if (error) {
      logger.warn({ err: error, bucket }, 'Supabase leaderboard query returned error');
    } else if (data) {
      rows = data;
    }
  } catch (err) {
    logger.error({ err, bucket }, 'Supabase leaderboard query threw');
  }

  const entries = rows.map((r) => [r.user_id, r.count]);
  const container = buildLeaderboardContainer(bucket, entries);
  const msgIdKey = `leaderboard:msg:${bucket}`;
  const msgId = await redis.get(msgIdKey);

  if (msgId) {
    try {
      const msg = await channel.messages.fetch(msgId);
      await msg.edit({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
      });
      logger.info({ bucket, msgId }, 'Leaderboard updated');
      return;
    } catch (err) {
      logger.warn({ err, bucket, msgId }, 'Failed to edit existing leaderboard — will send new');
      await redis.del(msgIdKey).catch(() => {});
    }
  }

  try {
    const sent = await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container]
    });
    await redis.set(msgIdKey, sent.id);
    logger.info({ bucket, msgId: sent.id }, 'New leaderboard sent');
  } catch (err) {
    logger.error({ err, bucket }, 'Failed to send leaderboard');
  }
}
