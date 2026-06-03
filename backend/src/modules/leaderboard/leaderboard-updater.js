import { EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, messagesKey } from './redis-keys.js';

const EMBED_COLORS = {
  daily: 0x57F287,
  weekly: 0x5865F2,
  monthly: 0xFEE75C
};

const EMBED_TITLES = {
  daily: 'CHAT LEADERBOARD — DAILY',
  weekly: 'CHAT LEADERBOARD — WEEKLY',
  monthly: 'CHAT LEADERBOARD — MONTHLY'
};

function getNextHourUnix() {
  const now = Date.now();
  const nextHour = Math.ceil(now / 3600000) * 3600000;
  return Math.floor(nextHour / 1000);
}

function getResetUnix(bucket) {
  const now = new Date();
  switch (bucket) {
    case 'daily': {
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      return Math.floor(next.getTime() / 1000);
    }
    case 'weekly': {
      const dayOfWeek = now.getUTCDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
      return Math.floor(next.getTime() / 1000);
    }
    case 'monthly': {
      const nextMonth = now.getUTCMonth() + 1;
      const nextYear = nextMonth > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
      const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;
      const next = new Date(Date.UTC(nextYear, nextMonthIndex, 1));
      return Math.floor(next.getTime() / 1000);
    }
    default:
      return 0;
  }
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
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

  const descriptionLines = sorted.map(([userId, count], i) => {
    return `**${i + 1}.** <@${userId}>  **${formatNumber(count)}** messages`;
  });
  const description = descriptionLines.length > 0
    ? descriptionLines.join('\n')
    : 'No data yet.';

  const embed = new EmbedBuilder()
    .setTitle(EMBED_TITLES[bucket])
    .setColor(EMBED_COLORS[bucket])
    .setDescription(description)
    .addFields(
      { name: '🔄 Updates', value: `<t:${getNextHourUnix()}:R>`, inline: false },
      { name: '🔄 Resets', value: `<t:${getResetUnix(bucket)}:R>`, inline: false }
    )
    .setFooter({ text: 'Last updated' })
    .setTimestamp();

  const msgId = await redis.get(REDIS_KEYS[`leaderboardMsg${bucket.charAt(0).toUpperCase() + bucket.slice(1)}`]);

  if (msgId) {
    try {
      const msg = await channel.messages.fetch(msgId);
      await msg.edit({ embeds: [embed] });
      logger.info({ bucket, msgId }, 'Leaderboard embed updated');
      return;
    } catch {
      logger.warn({ bucket, msgId }, 'Existing leaderboard message not found, creating new one');
      await redis.del(REDIS_KEYS[`leaderboardMsg${bucket.charAt(0).toUpperCase() + bucket.slice(1)}`]);
    }
  }

  try {
    const sent = await channel.send({ embeds: [embed] });
    const key = `leaderboard:msg:${bucket}`;
    await redis.set(key, sent.id);
    logger.info({ bucket, msgId: sent.id }, 'New leaderboard embed sent');
  } catch (err) {
    logger.error({ err, bucket }, 'Failed to send leaderboard embed');
  }
}
