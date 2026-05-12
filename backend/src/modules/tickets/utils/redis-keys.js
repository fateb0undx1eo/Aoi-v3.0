/**
 * Redis key management for the tickets module
 * Defines all Redis key patterns used throughout the system
 */

const PREFIX = 'tickets';

/**
 * Redis key patterns
 */
export const REDIS_KEYS = {
  // Cooldowns - track when users last closed a ticket
  // Format: tickets:cooldown:{userId}
  // Value: Unix timestamp
  cooldown: (userId) => `${PREFIX}:cooldown:${userId}`,

  // Creation locks - prevent race conditions when creating tickets
  // Format: tickets:creating:{userId}
  // Value: Unix timestamp or any truthy value
  creatingLock: (userId) => `${PREFIX}:creating:${userId}`,

  // Webhook cache - store webhook ID for the log channel
  // Format: tickets:webhook:cache
  // Value: JSON { id, token }
  webhookCache: () => `${PREFIX}:webhook:cache`,

  // Thread state - map thread IDs to their metadata
  // Format: tickets:thread:{threadId}
  // Value: JSON { creatorId, guildId, tagValue, createdAt }
  thread: (threadId) => `${PREFIX}:thread:${threadId}`,

  // User ticket map - track active tickets per user per channel
  // Format: tickets:user_tickets:{guildId}:{channelId}:{userId}
  // Value: array of thread IDs
  userTickets: (guildId, channelId, userId) => `${PREFIX}:user_tickets:${guildId}:${channelId}:${userId}`,

  // Lock service distributed locks
  // Format: tickets:lock:{resourceName}
  // Value: Unix timestamp + TTL
  lock: (resourceName) => `${PREFIX}:lock:${resourceName}`,

  // Metrics - track performance and usage
  // Format: tickets:metrics:{metricType}:{period}
  metrics: (type, period) => `${PREFIX}:metrics:${type}:${period}`,

  // Reconciliation tracking - for Discord state sync
  // Format: tickets:reconciliation:last_run
  // Value: Unix timestamp
  reconciliationLastRun: () => `${PREFIX}:reconciliation:last_run`,

  // Blacklist - temporarily cache blocked users
  // Format: tickets:blacklist:{userId}
  // Value: any truthy value
  blacklist: (userId) => `${PREFIX}:blacklist:${userId}`
};

/**
 * Gets TTL value for a key type in seconds
 */
export const KEY_TTLS = {
  COOLDOWN: 60 * 10, // 10 minutes
  CREATING_LOCK: 30, // 30 seconds
  WEBHOOK_CACHE: 60 * 60 * 24, // 24 hours
  THREAD_STATE: 60 * 60 * 24 * 7, // 7 days
  USER_TICKETS: 60 * 60 * 24, // 24 hours
  DISTRIBUTED_LOCK: 30, // 30 seconds
  METRICS: 60 * 60 * 24 * 30, // 30 days
  RECONCILIATION_TS: 60 * 60 * 24, // 24 hours
  BLACKLIST: 60 * 60, // 1 hour
  NONE: -1 // No expiration
};

/**
 * Deletes all ticket-related Redis keys matching a pattern
 * Used for cleanup operations
 */
export async function deleteTicketKeys(redis, pattern) {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}

/**
 * Flushes all ticket module keys from Redis
 * Use with caution - only in testing or maintenance
 */
export async function flushTicketKeys(redis) {
  return deleteTicketKeys(redis, `${PREFIX}:*`);
}

export default {
  REDIS_KEYS,
  KEY_TTLS,
  deleteTicketKeys,
  flushTicketKeys
};
