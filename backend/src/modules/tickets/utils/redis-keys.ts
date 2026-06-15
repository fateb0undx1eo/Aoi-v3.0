import type { RedisClient } from '../../../types/index.js';

const PREFIX = 'tickets';

export const REDIS_KEYS = {
  cooldown: (userId: string) => `${PREFIX}:cooldown:${userId}`,
  creatingLock: (userId: string) => `${PREFIX}:creating:${userId}`,
  webhookCache: () => `${PREFIX}:webhook:cache`,
  thread: (threadId: string) => `${PREFIX}:thread:${threadId}`,
  userTickets: (guildId: string, channelId: string, userId: string) => `${PREFIX}:user_tickets:${guildId}:${channelId}:${userId}`,
  lock: (resourceName: string) => `${PREFIX}:lock:${resourceName}`,
  metrics: (type: string, period: string) => `${PREFIX}:metrics:${type}:${period}`,
  reconciliationLastRun: () => `${PREFIX}:reconciliation:last_run`,
  blacklist: (guildId: string, userId: string) => `${PREFIX}:blacklist:${guildId}:${userId}`,
  blacklistSet: (guildId: string) => `${PREFIX}:blacklist:${guildId}`
} as const;

export const KEY_TTLS = {
  COOLDOWN: 60 * 10,
  CREATING_LOCK: 30,
  WEBHOOK_CACHE: 60 * 60 * 24,
  THREAD_STATE: 60 * 60 * 24 * 7,
  USER_TICKETS: 60 * 60 * 24,
  DISTRIBUTED_LOCK: 30,
  METRICS: 60 * 60 * 24 * 30,
  RECONCILIATION_TS: 60 * 60 * 24,
  BLACKLIST: 60 * 60,
  NONE: -1
} as const;

export async function deleteTicketKeys(redis: RedisClient, pattern: string): Promise<number> {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}

export async function flushTicketKeys(redis: RedisClient): Promise<number> {
  return deleteTicketKeys(redis, `${PREFIX}:*`);
}

export default {
  REDIS_KEYS,
  KEY_TTLS,
  deleteTicketKeys,
  flushTicketKeys
};
