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

const HEADER_MSG_KEY = 'leaderboard:msg:header';
const SILENT_MENTIONS = { parse: [] };

function getRankEmoji(rank) {
  if (rank >= 1 && rank <= 10) return `**${RANK_EMOJIS[rank - 1]}**`;
  return `**${rank}.**`;
}

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

function buildHeaderContent() {
  return '# <:Empty:1503044372487471328> <:trophy:1511688001321828403> CHAT LEADERBOARD';
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
      components.push({ type: 10, content: `${getRankEmoji(i + 1)}<@${entries[i][0]}> → **${formatNumber(entries[i][1])}** messages` });
    }
  }

  components.push({ type: 14, divider: true });
  components.push({ type: 10, content: `-# \`UPDATES\`<t:${getNextHourUnix()}:R><:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328><:Empty:1503044372487471328> \`RESETS\`<t:${getResetUnix(bucket)}:R>` });

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

  await updateOrCreateMessage(redis, channel, HEADER_MSG_KEY, { content: buildHeaderContent() });

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
  const msgKey = `leaderboard:msg:${bucket}`;

  await updateOrCreateMessage(redis, channel, msgKey, { components: [container] });
}
