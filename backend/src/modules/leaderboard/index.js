import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, activeUsersSyncingKey, messagesKey, leaderboardMsgKey, HEARTBEAT_TTL_SECONDS, FORCE_UPDATE_COOLDOWN_MS } from './redis-keys.js';
import { updateLeaderboard } from './leaderboard-updater.js';
import { getLeaderboardHealth } from './health.js';
import { handleSetupLeaderboard } from './commands/setup-leaderboard.js';
import { handleForceUpdateLeaderboard } from './commands/force-update-leaderboard.js';

const UPDATE_INTERVAL_MS = (Number(process.env.LEADERBOARD_UPDATE_INTERVAL_MINUTES) || 60) * 60 * 1000;
const SYNC_INTERVAL_MS = (Number(process.env.LEADERBOARD_SYNC_INTERVAL_MINUTES) || 10) * 60 * 1000;

const LUA_SYNC_BUCKET = `
  redis.call('DEL', KEYS[2])
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

  const rawClient = redis.getClient();
  if (!rawClient) return;

  const userId = message.author.id;
  rawClient.multi()
    .incr(messagesKey('daily', userId))
    .incr(messagesKey('weekly', userId))
    .incr(messagesKey('monthly', userId))
    .sAdd(activeUsersKey('daily'), userId)
    .sAdd(activeUsersKey('weekly'), userId)
    .sAdd(activeUsersKey('monthly'), userId)
    .exec()
    .catch((err) => logger.warn({ err }, 'Leaderboard count pipeline failed'));
}

const forceUpdateCooldowns = new Map();

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

  const channelId = await redis.get(REDIS_KEYS.leaderboardChannel);
  if (!channelId) {
    logger.info('Leaderboard not configured, skipping startup');
    return;
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

  let allValid = true;
  for (const bucket of BUCKETS) {
    const msgId = await redis.get(`leaderboard:msg:${bucket}`);
    if (msgId) {
      try {
        await channel.messages.fetch(msgId);
      } catch {
        logger.warn({ bucket, msgId }, 'Stored message deleted, will recreate on next update');
        await redis.del(`leaderboard:msg:${bucket}`).catch((err) => logger.debug({ err, bucket }, 'Cleanup of stale leaderboard msg key failed'));
        allValid = false;
      }
    } else {
      allValid = false;
    }
  }

  if (allValid) {
    updateLeaderboard(redis, discordClient, supabase).catch((err) => logger.warn({ err }, 'Startup leaderboard update failed'));
  }

  const d = await redis.get(leaderboardMsgKey('daily')) || 'none';
  const w = await redis.get(leaderboardMsgKey('weekly')) || 'none';
  const m = await redis.get(leaderboardMsgKey('monthly')) || 'none';
  logger.info(`Leaderboard ready. Daily: ${d}, Weekly: ${w}, Monthly: ${m}`);
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
      await resetBucket(redis, 'daily');
      if (now.getUTCDay() === 1) await resetBucket(redis, 'weekly');
      if (now.getUTCDate() === 1) await resetBucket(redis, 'monthly');
    }));
  }

  if (discordClient.isReady()) {
    start();
  } else {
    discordClient.once('ready', start);
  }

  logger.info('Leaderboard module initialized');

  return {
    name: 'leaderboard',

    configSchema: {
      type: 'object',
      properties: {}
    },

    commands: [
      {
        name: 'setup-leaderboard',
        description: 'Configure the leaderboard system',
        options: [
          {
            name: 'channel',
            type: 7,
            description: 'Channel to post leaderboard embeds',
            required: true
          }
        ],
        async execute(interaction) {
          try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: 'You need Administrator permission to use this command.' }] }]
              });
              return;
            }
            await handleSetupLeaderboard(interaction, { redis, discordClient, database, supabase });
          } catch (error) {
            logger.error({ err: error }, 'Setup-leaderboard command failed');
            try {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: `Error: ${error.message}` }] }]
              });
            } catch (innerErr) {
              logger.debug({ err: innerErr }, 'Failed to send setup-leaderboard error reply');
            }
          }
        }
      },
      {
        name: 'force-update-leaderboard',
        description: 'Force an immediate leaderboard update',
        async execute(interaction) {
          try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
                !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: 'You need Administrator or Manage Server permission to use this command.' }] }]
              });
              return;
            }

            const now = Date.now();
            const lastRun = forceUpdateCooldowns.get(interaction.guildId) || 0;
            if (now - lastRun < FORCE_UPDATE_COOLDOWN_MS) {
              const remaining = Math.ceil((FORCE_UPDATE_COOLDOWN_MS - (now - lastRun)) / 1000);
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: `Please wait ${remaining}s before updating again.` }] }]
              });
              return;
            }
            forceUpdateCooldowns.set(interaction.guildId, now);

            await handleForceUpdateLeaderboard(interaction, { redis, discordClient, database, supabase });
          } catch (error) {
            logger.error({ err: error }, 'Force-update-leaderboard command failed');
            try {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: `Error: ${error.message}` }] }]
              });
            } catch (innerErr) {
              logger.debug({ err: innerErr }, 'Failed to send force-update-leaderboard error reply');
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
      forceUpdateCooldowns.clear();
      logger.info('Leaderboard module shutdown complete');
    }
  };
}

export default initializeLeaderboardModule;
