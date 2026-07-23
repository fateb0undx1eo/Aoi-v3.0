import { MessageFlags } from 'discord.js';
import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { REDIS_KEYS, BUCKETS } from './redis-keys.js';
import { updateLeaderboard } from './leaderboard-updater.js';
import { getLeaderboardHealth } from './health.js';
import {
  UPDATE_INTERVAL_MS, SYNC_INTERVAL_MS, performSync, resetBucket, bootstrap, LEADERBOARD_CHANNEL_ID
} from './helpers.js';
import { createSetupCommand } from './commands/setup.js';
import { createMessageCountCommand } from './commands/messageCount.js';
import { createMessageTrackingEvent } from './events/messageTracking.js';
import type { RedisClient } from '../../types/index.js';
import type { Client } from 'discord.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScheduledTask } from 'node-cron';

export async function initializeLeaderboardModule(options: {
  database: any;
  redis: RedisClient;
  discordClient: Client;
}) {
  const { database, redis, discordClient } = options;
  const supabase = (await import('../../database/supabase.js')).supabase as SupabaseClient;

  let updateIntervalId: ReturnType<typeof setInterval> | null = null;
  let syncIntervalId: ReturnType<typeof setInterval> | null = null;
  let cronTasks: ScheduledTask[] = [];
  let started = false;
  let syncInProgress = false;

  function withTimeout<T>(promise: Promise<T>, label: string, ms = 60000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
    ]);
  }

  function start(): void {
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
    discordClient.once('clientReady', start as (...args: any[]) => void);
  }

  logger.info('Leaderboard module initialized');

  return {
    name: 'leaderboard',

    configSchema: {
      type: 'object',
      properties: {} as Record<string, any>
    },

    commands: [
      createSetupCommand(redis, discordClient, supabase),
      createMessageCountCommand(redis)
    ],

    events: [
      createMessageTrackingEvent(redis)
    ],

    services: {
      getLeaderboardHealth: (r?: RedisClient) => getLeaderboardHealth(r || redis),
      updateLeaderboard: (s?: SupabaseClient) => updateLeaderboard(redis, discordClient, s || supabase)
    },

    async shutdown(): Promise<void> {
      if (updateIntervalId) { clearInterval(updateIntervalId); updateIntervalId = null; }
      if (syncIntervalId) { clearInterval(syncIntervalId); syncIntervalId = null; }
      for (const task of cronTasks) task.stop();
      logger.info('Leaderboard module shutdown complete');
    }
  };
}

export default initializeLeaderboardModule;
