import { MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS } from './redis-keys.js';

const RANK_EMOJIS = [
  '<:1one:1511749251477274684>',
  '<:2two:1511757535936385236>',
  '<:3three:1511757552722116749>',
  '<:4four:1511757568865997001>',
  '<:5five:1511757583764164648>',
  '<:6six:1511757598989484153>',
  '<:7seven:1511757614990495764>',
  '<:8eight:1511757635655827677>',
  '<:9nine:1511757652714061985>',
  '<:10ten:1511757667092136108>'
];

const SILENT_MENTIONS = { parse: [] };

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

const TITLES = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY'
};

function buildLeaderboardContainer(bucket, entries) {
  const components = [{ type: 10, content: `### ${TITLES[bucket]}` }];

  if (entries.length === 0) {
    components.push({ type: 10, content: '_No messages recorded yet._' });
  } else {
    for (let i = 0; i < entries.length; i++) {
      const rankStr = i < 10 ? RANK_EMOJIS[i] : `${i + 1}.`;
      components.push({ type: 10, content: `**${rankStr} ${entries[i][1]} → ${formatNumber(entries[i][2])} messages**` });
    }
  }

  components.push({ type: 14, divider: true });
  components.push({ type: 10, content: `-# \`UPDATES\` <t:${getNextHourUnix()}:R>  <a:fish111:1511786107384103082>  \`RESETS\` <t:${getResetUnix(bucket)}:R>` });

  return {
    type: 17,
    components
  };
}

async function updateOrCreateMessage(redis, channel, msgKey, opts) {
  const msgId = await redis.get(msgKey);
  const base = { allowedMentions: SILENT_MENTIONS };

  if (msgId) {
    try {
      const msg = await channel.messages.fetch(msgId);
      await msg.edit({ ...base, ...opts });
      logger.info({ msgId, msgKey }, 'Leaderboard message updated');
      return;
    } catch {
      logger.warn({ msgId, msgKey }, 'Stored message not found, will send new');
      await redis.del(msgKey).catch(() => {});
    }
  }

  try {
    const sendOpts = opts.components ? { ...base, ...opts, flags: MessageFlags.IsComponentsV2 } : { ...base, ...opts };
    const sent = await channel.send(sendOpts);
    await redis.set(msgKey, sent.id);
    logger.info({ msgId: sent.id, msgKey }, 'Leaderboard message sent');
  } catch (err) {
    logger.error({ err, msgKey }, 'Failed to send leaderboard message');
  }
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

  const bucketsData = {};
  const allIds = new Set();

  for (const bucket of BUCKETS) {
    let rows = [];
    try {
      const { data, error } = await supabase.rpc(`get_leaderboard_${bucket}`, { p_limit: 10, p_offset: 0 });
      if (!error && data) rows = data;
    } catch {}
    bucketsData[bucket] = rows;
    for (const r of rows) allIds.add(r.user_id);
  }

  const usernameMap = new Map();
  if (allIds.size > 0) {
    const results = await Promise.allSettled(
      [...allIds].map(id => discordClient.users.fetch(id))
    );
    for (const result of results) {
      if (result.status === 'fulfilled') usernameMap.set(result.value.id, result.value.username);
    }
  }

  for (const bucket of BUCKETS) {
    const entries = bucketsData[bucket].map(r => [
      r.user_id,
      usernameMap.get(r.user_id) || r.user_id,
      r.count
    ]);
    const container = buildLeaderboardContainer(bucket, entries);
    const msgKey = `leaderboard:msg:${bucket}`;
    await updateOrCreateMessage(redis, channel, msgKey, { components: [container] });
  }

  await redis.set(REDIS_KEYS.workerLastLeaderboardUpdate, new Date().toISOString());
  logger.info('All leaderboards updated');
}
