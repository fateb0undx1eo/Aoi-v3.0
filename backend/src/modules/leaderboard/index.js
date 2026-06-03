import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS, activeUsersKey, activeUsersSyncingKey, messagesKey } from './redis-keys.js';
import { updateLeaderboard } from './leaderboard-updater.js';
import { getLeaderboardHealth } from './health.js';
import { handleSetupLeaderboard } from './commands/setup-leaderboard.js';
import { handleForceUpdateLeaderboard } from './commands/force-update-leaderboard.js';

const UPDATE_INTERVAL_MS = (Number(process.env.LEADERBOARD_UPDATE_INTERVAL_MINUTES) || 60) * 60 * 1000;
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
    try {
      const count = await rawClient.eval(LUA_GET_AND_RESET, { keys: [messagesKey(bucket, userId)] });
      results.push({ userId, count: Number(count) });
    } catch (err) {
      logger.error({ err, userId, bucket }, 'Failed to get/reset counter');
    }
  }
  return results;
}

async function performSync(redis, supabase) {
  const rawClient = redis.getClient();
  if (!rawClient) return;

  const allUserCounts = new Map();

  for (const bucket of BUCKETS) {
    try {
      await rawClient.rename(activeUsersKey(bucket), activeUsersSyncingKey(bucket));
    } catch (err) {
      if (!err.message?.includes('no such key')) {
        logger.error({ err, bucket }, 'Failed to rename active_users set');
      }
    }
    const bucketResults = await processBucket(rawClient, bucket);
    for (const { userId, count } of bucketResults) {
      if (!allUserCounts.has(userId)) {
        allUserCounts.set(userId, { p_user_id: userId, p_daily_count: 0, p_weekly_count: 0, p_monthly_count: 0 });
      }
      allUserCounts.get(userId)[`p_${bucket}_count`] = count;
    }
  }

  if (allUserCounts.size === 0) {
    await redis.set(REDIS_KEYS.workerLastSync, new Date().toISOString());
    await redis.setex(REDIS_KEYS.workerHeartbeat, 1200, new Date().toISOString());
    return;
  }

  const updates = [...allUserCounts.values()];
  const { error } = await supabase.rpc('bulk_increment_counts', { updates });

  if (error) {
    logger.error({ err: error, count: updates.length }, 'Supabase bulk_increment failed, restoring counts');
    for (const update of updates) {
      const restorePipeline = rawClient.multi();
      for (const bucket of BUCKETS) {
        const count = update[`p_${bucket}_count`];
        if (count > 0) {
          restorePipeline.incrBy(messagesKey(bucket, update.p_user_id), count);
        }
      }
      await restorePipeline.exec();
      const addPipeline = rawClient.multi();
      for (const bucket of BUCKETS) {
        if (update[`p_${bucket}_count`] > 0) {
          addPipeline.sAdd(activeUsersKey(bucket), update.p_user_id);
        }
      }
      await addPipeline.exec();
    }
    return;
  }

  for (const bucket of BUCKETS) {
    try { await rawClient.del(activeUsersSyncingKey(bucket)); } catch {}
  }

  await redis.set(REDIS_KEYS.workerLastSync, new Date().toISOString());
  await redis.setex(REDIS_KEYS.workerHeartbeat, 1200, new Date().toISOString());
  logger.info({ userCount: updates.length }, 'Sync cycle completed');
}

async function resetBucket(redis, bucket) {
  const rawClient = redis.getClient();
  if (!rawClient) return 0;

  let members = [];
  try { members = [...new Set([
    ...(await rawClient.sMembers(activeUsersKey(bucket))),
    ...(await rawClient.sMembers(activeUsersSyncingKey(bucket)))
  ])]; } catch {}

  if (members.length > 0) {
    const pipeline = rawClient.multi();
    for (const userId of members) pipeline.del(messagesKey(bucket, userId));
    pipeline.del(activeUsersKey(bucket));
    pipeline.del(activeUsersSyncingKey(bucket));
    await pipeline.exec();
  }

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

export async function initializeLeaderboardModule(options) {
  const { database, redis, discordClient } = options;
  const supabase = (await import('../../database/supabase.js')).supabase;

  let updateIntervalId = null;
  let syncIntervalId = null;
  let cronTasks = [];

  async function startupChecks() {
    const channelId = await redis.get(REDIS_KEYS.leaderboardChannel);
    if (!channelId) { logger.info('Leaderboard not configured, skipping startup checks'); return; }

    const guild = discordClient.guilds.cache.first();
    if (!guild) { logger.warn('No guild available'); return; }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) { logger.warn({ channelId }, 'Leaderboard channel not accessible'); return; }

    let allValid = true;
    for (const bucket of BUCKETS) {
      const msgId = await redis.get(`leaderboard:msg:${bucket}`);
      if (msgId) {
        try { await channel.messages.fetch(msgId); }
        catch {
          logger.warn({ bucket, msgId }, 'Stored message deleted, will recreate');
          await redis.del(`leaderboard:msg:${bucket}`).catch(() => {});
          allValid = false;
        }
      } else { allValid = false; }
    }

    if (allValid) updateLeaderboard(redis, discordClient, supabase).catch(() => {});

    const d = await redis.get(REDIS_KEYS.leaderboardMsgDaily) || 'none';
    const w = await redis.get(REDIS_KEYS.leaderboardMsgWeekly) || 'none';
    const m = await redis.get(REDIS_KEYS.leaderboardMsgMonthly) || 'none';
    logger.info(`Leaderboard ready. Daily: ${d}, Weekly: ${w}, Monthly: ${m}`);
  }

  discordClient.once('ready', () => {
    startupChecks().catch((err) => logger.error({ err }, 'Leaderboard startup failed'));
  });

  if (discordClient.isReady()) {
    startupChecks().catch((err) => logger.error({ err }, 'Leaderboard startup failed'));
  }

  const runUpdate = () => updateLeaderboard(redis, discordClient, supabase).catch((err) => logger.error({ err }, 'Update failed'));
  updateIntervalId = setInterval(runUpdate, UPDATE_INTERVAL_MS);
  setTimeout(runUpdate, 5000);

  const runSync = () => performSync(redis, supabase).catch((err) => logger.error({ err }, 'Sync failed'));
  syncIntervalId = setInterval(runSync, SYNC_INTERVAL_MS);
  setTimeout(runSync, 10000);

  cronTasks.push(cron.schedule('1 0 * * *', () => resetBucket(redis, 'daily').catch((err) => logger.error({ err }, 'Daily reset failed'))));
  cronTasks.push(cron.schedule('1 0 * * 1', () => resetBucket(redis, 'weekly').catch((err) => logger.error({ err }, 'Weekly reset failed'))));
  cronTasks.push(cron.schedule('1 0 1 * *', () => resetBucket(redis, 'monthly').catch((err) => logger.error({ err }, 'Monthly reset failed'))));

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
            await handleSetupLeaderboard(interaction, { redis, discordClient, database });
          } catch (error) {
            logger.error({ err: error }, 'Setup-leaderboard command failed');
            try {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: `Error: ${error.message}` }] }]
              });
            } catch {}
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
            await handleForceUpdateLeaderboard(interaction, { redis, discordClient, database });
          } catch (error) {
            logger.error({ err: error }, 'Force-update-leaderboard command failed');
            try {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [{ type: 17, components: [{ type: 10, content: `Error: ${error.message}` }] }]
              });
            } catch {}
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
