import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, activeUsersSyncingKey, messagesKey, leaderboardMsgKey, HEARTBEAT_TTL_SECONDS, FORCE_UPDATE_COOLDOWN_MS } from './redis-keys.js';
import { updateLeaderboard } from './leaderboard-updater.js';
import { getLeaderboardHealth } from './health.js';

const LEADERBOARD_CHANNEL_ID = process.env.LEADERBOARD_CHANNEL_ID?.trim() || '';
const UPDATE_INTERVAL_MS = (Number(process.env.LEADERBOARD_UPDATE_INTERVAL_MINUTES) || 60) * 60 * 1000;
const SYNC_INTERVAL_MS = (Number(process.env.LEADERBOARD_SYNC_INTERVAL_MINUTES) || 10) * 60 * 1000;
const EXCLUDED_CATEGORY_IDS = (process.env.LEADERBOARD_EXCLUDED_CATEGORIES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LUA_SYNC_BUCKET = `
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

function parseSyncResults(raw, bucket) {
  const results = [];
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

async function performSync(redis, supabase) {
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

async function doSync(redis, supabase) {
  const rawClient = redis.getClient();
  if (!rawClient) return;

  const allUserCounts = new Map();

  for (const bucket of BUCKETS) {
    const prefix = `messages:${bucket}:`;
    let raw;
    try {
      raw = await rawClient.eval(LUA_SYNC_BUCKET, {
        keys: [activeUsersKey(bucket), activeUsersSyncingKey(bucket)],
        arguments: [prefix]
      });
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
      allUserCounts.get(userId)[`p_${bucket}_count`] = count;
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
      err: error,
      errCode: error.code,
      errHint: error.hint,
      errMessage: error.message,
      status,
      statusText,
      count: updates.length,
      sample: updates.slice(0, 3)
    }, 'Supabase bulk_increment failed, restoring counts');

    const restorePipeline = rawClient.multi();
    for (const update of updates) {
      for (const bucket of BUCKETS) {
        const count = update[`p_${bucket}_count`];
        if (count > 0) {
          restorePipeline.incrBy(messagesKey(bucket, update.p_user_id), count);
          restorePipeline.sAdd(activeUsersKey(bucket), update.p_user_id);
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

async function resetBucket(redis, bucket) {
  const lock = await redis.acquireLock('leaderboard:maintenance', 120000);
  if (!lock) {
    logger.debug('Maintenance lock held, skipping reset');
    return 0;
  }

  try {
    await doResetBucket(redis, bucket);
  } finally {
    await redis.releaseLock('leaderboard:maintenance', lock);
  }
}

async function doResetBucket(redis, bucket) {
  const rawClient = redis.getClient();
  if (!rawClient) return 0;

  let members = [];
  try {
    members = [...new Set([
      ...(await rawClient.sMembers(activeUsersKey(bucket))),
      ...(await rawClient.sMembers(activeUsersSyncingKey(bucket)))
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

function onMessage(redis, message) {
  if (message.author?.bot) return;
  if (!message.guild) return;
  if (message.channel?.parentId && EXCLUDED_CATEGORY_IDS.includes(message.channel.parentId)) return;

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
    .then((lastContent) => {
      if (lastContent === trimmed) {
        logger.debug({ userId, content: trimmed.slice(0, 50) }, 'Duplicate message skipped');
        return;
      }
      return rawClient.set(dedupKey, trimmed, { EX: 60 })
        .then(() => {
          rawClient.multi()
            .incr(messagesKey('daily', userId))
            .incr(messagesKey('weekly', userId))
            .incr(messagesKey('monthly', userId))
            .sAdd(activeUsersKey('daily'), userId)
            .sAdd(activeUsersKey('weekly'), userId)
            .sAdd(activeUsersKey('monthly'), userId)
            .exec()
            .then(() => {
              logger.debug({ userId, content: trimmed.slice(0, 50) }, 'Message counted');
            })
            .catch((err) => logger.warn({ err }, 'Leaderboard count pipeline failed'));
        });
    })
    .catch((err) => logger.warn({ err }, 'Leaderboard dedup check failed'));
}

async function validateRpcContract(supabase) {
  for (const bucket of BUCKETS) {
    try {
      const { error } = await supabase.rpc(`get_leaderboard_${bucket}`, { p_limit: 0, p_offset: 0 });
      if (error) {
        logger.error({ rpc: `get_leaderboard_${bucket}`, err: error }, 'Leaderboard RPC validation failed — missing migration?');
        return false;
      }
    } catch (err) {
      logger.error({ rpc: `get_leaderboard_${bucket}`, err }, 'Leaderboard RPC validation threw — check migration.sql');
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

async function recoverSyncingSets(redis) {
  const rawClient = redis.getClient();
  if (!rawClient) return;

  for (const bucket of BUCKETS) {
    const syncingKey = activeUsersSyncingKey(bucket);
    const activeKey = activeUsersKey(bucket);
    try {
      const count = await rawClient.sCard(syncingKey);
      if (count > 0) {
        logger.warn({ bucket, count }, 'Found leftover syncing set from previous crash — recovering');
        const members = await rawClient.sMembers(syncingKey);
        if (members.length > 0) {
          await rawClient.sAdd(activeKey, members);
        }
        await rawClient.del(syncingKey);
      }
    } catch (err) {
      logger.error({ err, bucket }, 'Failed to recover syncing set');
    }
  }
}

async function bootstrap(redis, discordClient, supabase) {
  await recoverSyncingSets(redis);
  const rpcOk = await validateRpcContract(supabase);
  if (!rpcOk) {
    logger.warn('Leaderboard RPC contract invalid — sync and updates will fail. Run migration.sql in Supabase.');
  }

  const envChannelId = LEADERBOARD_CHANNEL_ID;
  const redisChannelId = await redis.get(REDIS_KEYS.leaderboardChannel);
  const channelId = envChannelId || redisChannelId;

  if (!channelId) {
    logger.info('Leaderboard not configured (no LEADERBOARD_CHANNEL_ID in env and no channel in Redis), skipping startup');
    return;
  }

  if (envChannelId && envChannelId !== redisChannelId) {
    await redis.set(REDIS_KEYS.leaderboardChannel, envChannelId);
    logger.info({ channelId: envChannelId }, 'Leaderboard channel set from environment variable');
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
        await redis.del(key).catch((err) => logger.debug({ err, key }, 'Cleanup of stale leaderboard msg key failed'));
      }
    }
  }

  updateLeaderboard(redis, discordClient, supabase).catch((err) => logger.warn({ err }, 'Startup leaderboard update failed'));

  const h = await redis.get('leaderboard:msg:header') || 'none';
  const d = await redis.get(leaderboardMsgKey('daily')) || 'none';
  const w = await redis.get(leaderboardMsgKey('weekly')) || 'none';
  const m = await redis.get(leaderboardMsgKey('monthly')) || 'none';
  logger.info(`Leaderboard ready. Header: ${h}, Daily: ${d}, Weekly: ${w}, Monthly: ${m}`);
}

export async function initializeLeaderboardModule(options) {
  const { database, redis, discordClient } = options;
  const supabase = (await import('../../database/supabase.js')).supabase;

  let updateIntervalId = null;
  let syncIntervalId = null;
  let cronTasks = [];
  let started = false;
  let syncInProgress = false;

  function withTimeout(promise, label, ms = 60000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
    ]);
  }

  function start() {
    if (started) return;
    started = true;

    bootstrap(redis, discordClient, supabase).catch((err) => logger.error({ err }, 'Leaderboard startup failed'));

    const runUpdate = () => updateLeaderboard(redis, discordClient, supabase).catch((err) => logger.error({ err }, 'Update failed'));
    updateIntervalId = setInterval(runUpdate, UPDATE_INTERVAL_MS);
    setTimeout(runUpdate, 5000);

    const runSync = () => {
      if (syncInProgress) {
        logger.debug('Sync already in progress (in-memory guard), skipping');
        return;
      }
      syncInProgress = true;
      withTimeout(performSync(redis, supabase), 'Sync', 120000)
        .catch((err) => logger.error({ err }, 'Sync failed'))
        .finally(() => { syncInProgress = false; });
    };
    syncIntervalId = setInterval(runSync, SYNC_INTERVAL_MS);
    setTimeout(runSync, 10000);

    cronTasks.push(cron.schedule('1 0 * * *', async () => {
      const now = new Date();
      try {
        await withTimeout(performSync(redis, supabase), 'Pre-reset sync', 120000);
      } catch (err) {
        logger.error({ err }, 'Pre-reset sync failed, resetting anyway');
      }
      await resetBucket(redis, 'daily');
      if (now.getUTCDay() === 1) await resetBucket(redis, 'weekly');
      if (now.getUTCDate() === 1) await resetBucket(redis, 'monthly');
    }));
  }

  if (discordClient.isReady()) {
    start();
  } else {
    discordClient.once('clientReady', start);
  }

  logger.info('Leaderboard module initialized');

  async function ensureLeaderboardMessages(channel, redis) {
    const headerId = await redis.get('leaderboard:msg:header');
    if (headerId) return true;

    try {
      const header = await channel.send({ content: '# <:Empty:1503044372487471328> <:trophy:1511688001321828403> CHAT LEADERBOARD' });
      await redis.set('leaderboard:msg:header', header.id);
    } catch {
      return false;
    }

    const buckets = ['monthly', 'weekly', 'daily'];
    const titles = ['MONTHLY', 'WEEKLY', 'DAILY'];

    for (let i = 0; i < buckets.length; i++) {
      const container = {
        type: 17,
        components: [
          { type: 10, content: `### ${titles[i]}` },
          { type: 10, content: 'Loading...' }
        ]
      };
      try {
        const sent = await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
        await redis.set(`leaderboard:msg:${buckets[i]}`, sent.id);
      } catch {
        return false;
      }
    }

    return true;
  }

  return {
    name: 'leaderboard',

    configSchema: {
      type: 'object',
      properties: {}
    },

    commands: [
      {
        name: 'leaderboard',
        description: 'Set up or update the leaderboard',
        async execute(interaction) {
          try {
            const isOwner = interaction.guild?.ownerId === interaction.user.id;
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && !isOwner) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: 'You need to be an Administrator or server owner to use this command.' }] }]
              });
              return;
            }

            const channelId = LEADERBOARD_CHANNEL_ID || (await redis.get(REDIS_KEYS.leaderboardChannel));
            if (!channelId) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard channel not configured. Set LEADERBOARD_CHANNEL_ID in .env.' }] }]
              });
              return;
            }

            const channel = await discordClient.channels.fetch(channelId).catch(() => null);
            if (!channel?.isTextBased()) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard channel not found or not text-based.' }] }]
              });
              return;
            }

            if (LEADERBOARD_CHANNEL_ID && LEADERBOARD_CHANNEL_ID !== (await redis.get(REDIS_KEYS.leaderboardChannel))) {
              await redis.set(REDIS_KEYS.leaderboardChannel, LEADERBOARD_CHANNEL_ID);
            }

            const existing = await redis.get('leaderboard:msg:header');
            if (!existing) {
              const ok = await ensureLeaderboardMessages(channel, redis);
              if (!ok) {
                await interaction.editReply({
                  flags: MessageFlags.IsComponentsV2,
                  components: [{ type: 17, components: [{ type: 10, content: 'Failed to create leaderboard messages.' }] }]
                });
                return;
              }
            }

            await updateLeaderboard(redis, discordClient, supabase);

            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [{ type: 17, components: [{ type: 10, content: 'Leaderboard updated.' }] }]
            });
          } catch (error) {
            logger.error({ err: error }, 'Leaderboard command failed');
            try {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: `Error: ${error.message}` }] }]
              });
            } catch (innerErr) {
              logger.debug({ err: innerErr }, 'Failed to send leaderboard error reply');
            }
          }
        }
      },
      {
        name: 'message',
        description: 'Message leaderboard commands',
        options: [
          {
            name: 'count',
            type: 1,
            description: 'Show your message count'
          }
        ],
        async execute(interaction) {
          const subcommand = interaction.options.getSubcommand(true);
          if (subcommand !== 'count') return;

          try {
            const userId = interaction.user.id;
            let daily = 0, weekly = 0, monthly = 0;

            if (redis.isReady?.()) {
              const results = await redis.mget(messagesKey('daily', userId), messagesKey('weekly', userId), messagesKey('monthly', userId));
              daily = Number(results[0]) || 0;
              weekly = Number(results[1]) || 0;
              monthly = Number(results[2]) || 0;
            }

            const total = daily + weekly + monthly;

            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              components: [{
                type: 17,
                components: [
                  { type: 10, content: `**YOU HAVE ${total.toLocaleString('en-US')} MESSAGES**` }
                ]
              }]
            });
          } catch (error) {
            logger.error({ err: error }, 'Message count command failed');
            try {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: `Error: ${error.message}` }] }]
              });
            } catch (innerErr) {
              logger.debug({ err: innerErr }, 'Failed to send message count error reply');
            }
          }
        }
      }
    ],

    events: [
      {
        name: 'messageCreate',
        async execute(message) {
          onMessage(redis, message);
        }
      }
    ],

    services: {
      getLeaderboardHealth: (r) => getLeaderboardHealth(r || redis),
      updateLeaderboard: (s) => updateLeaderboard(redis, discordClient, s || supabase)
    },

    async shutdown() {
      if (updateIntervalId) { clearInterval(updateIntervalId); updateIntervalId = null; }
      if (syncIntervalId) { clearInterval(syncIntervalId); syncIntervalId = null; }
      for (const task of cronTasks) task.stop();
      logger.info('Leaderboard module shutdown complete');
    }
  };
}

export default initializeLeaderboardModule;
