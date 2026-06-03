import { MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, messagesKey } from './redis-keys.js';

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
    case 'daily': {
      return Math.floor((utc + 86400000) / 1000);
    }
    case 'weekly': {
      const dayOfWeek = now.getUTCDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
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

function buildLeaderboardContainer(bucket, sorted) {
  const lines = [`# ${TITLES[bucket]}`];

  if (sorted.length === 0) {
    lines.push('No data yet.');
  } else {
    for (let i = 0; i < sorted.length; i++) {
      lines.push(`**${i + 1}.** <@${sorted[i][0]}>  **${formatNumber(sorted[i][1])}** messages`);
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
  const channelId = await redis.get(REDIS_KEYS.leaderboardChannel);
  if (!channelId) {
    logger.warn('Leaderboard channel not configured');
    return;
  }

  const guild = discordClient.guilds.cache.first();
  if (!guild) {
    logger.warn('No guild available for leaderboard update');
    return;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    logger.warn({ channelId }, 'Leaderboard channel not found or not text-based');
    return;
  }

  const rawClient = redis.getClient();

  for (const bucket of BUCKETS) {
    await updateSingleLeaderboard(bucket, redis, rawClient, supabase, channel, guild);
  }

  await redis.set(REDIS_KEYS.workerLastLeaderboardUpdate, new Date().toISOString());
  logger.info('All leaderboards updated');
}

async function updateSingleLeaderboard(bucket, redis, rawClient, supabase, channel, guild) {
  const rpcName = `get_leaderboard_${bucket}`;

  let supabaseResults = [];
  try {
    const { data, error } = await supabase.rpc(rpcName, { p_limit: 15, p_offset: 0 });
    if (!error && data) {
      supabaseResults = data;
    }
  } catch (err) {
    logger.warn({ err, bucket }, 'Supabase leaderboard query failed');
  }

  let redisLiveCounts = new Map();
  if (rawClient) {
    try {
      const activeMembers = await rawClient.sMembers(activeUsersKey(bucket));
      if (activeMembers.length > 0) {
        const pipeline = rawClient.multi();
        for (const userId of activeMembers) {
          pipeline.get(messagesKey(bucket, userId));
        }
        const results = await pipeline.exec();
        for (let i = 0; i < activeMembers.length; i++) {
          const count = results[i] ? Number(results[i]) : 0;
          if (count > 0) {
            redisLiveCounts.set(activeMembers[i], count);
          }
        }
      }
    } catch (err) {
      logger.warn({ err, bucket }, 'Failed to fetch Redis live counts');
    }
  }

  const mergedMap = new Map();
  for (const row of supabaseResults) {
    mergedMap.set(row.user_id, (mergedMap.get(row.user_id) || 0) + row.count);
  }
  for (const [userId, count] of redisLiveCounts) {
    mergedMap.set(userId, (mergedMap.get(userId) || 0) + count);
  }

  const sorted = [...mergedMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const container = buildLeaderboardContainer(bucket, sorted);
  const msgId = await redis.get(`leaderboard:msg:${bucket}`);

  if (msgId) {
    try {
      const msg = await channel.messages.fetch(msgId);
      await msg.edit({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
      });
      logger.info({ bucket, msgId }, 'Leaderboard updated');
      return;
    } catch {
      logger.warn({ bucket, msgId }, 'Existing leaderboard message not found, creating new one');
      await redis.del(`leaderboard:msg:${bucket}`).catch(() => {});
    }
  }

  try {
    const sent = await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container]
    });
    await redis.set(`leaderboard:msg:${bucket}`, sent.id);
    logger.info({ bucket, msgId: sent.id }, 'New leaderboard sent');
  } catch (err) {
    logger.error({ err, bucket }, 'Failed to send leaderboard');
  }
}
