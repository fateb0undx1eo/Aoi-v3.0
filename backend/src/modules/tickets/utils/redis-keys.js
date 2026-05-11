/**
 * Redis key management utilities
 * Centralized key generation for all Redis operations
 */

/**
 * Generate Redis key with consistent naming
 * @param {...string} parts - Key parts
 * @returns {string} Generated Redis key
 */
export function generateRedisKey(...parts) {
  return parts.filter(Boolean).join(':');
}

/**
 * Cooldown keys
 */
export const COOLDOWN_KEYS = {
  userCooldown: (guildId, userId, reason = 'ticket_creation') => 
    generateRedisKey('tickets', 'cooldown', guildId, userId, reason),
  
  guildCooldowns: (guildId) => 
    generateRedisKey('tickets', 'cooldown', guildId, '*'),
  
  userCooldowns: (userId) => 
    generateRedisKey('tickets', 'cooldown', '*', userId, '*')
};

/**
 * Lock keys for distributed operations
 */
export const LOCK_KEYS = {
  creationLock: (guildId, userId) => 
    generateRedisKey('tickets', 'lock', 'create', guildId, userId),
  
  resolutionLock: (threadId) => 
    generateRedisKey('tickets', 'lock', 'resolve', threadId),
  
  webhookLock: (channelId) => 
    generateRedisKey('tickets', 'lock', 'webhook', channelId)
};

/**
 * Cache keys
 */
export const CACHE_KEYS = {
  webhook: (channelId) => 
    generateRedisKey('tickets', 'cache', 'webhook', channelId),
  
  ticket: (threadId) => 
    generateRedisKey('tickets', 'cache', 'ticket', threadId),
  
  userTickets: (guildId, userId) => 
    generateRedisKey('tickets', 'cache', 'user', guildId, userId),
  
  guildTickets: (guildId) => 
    generateRedisKey('tickets', 'cache', 'guild', guildId)
};

/**
 * Metrics keys
 */
export const METRICS_KEYS = {
  operation: (operation) => 
    generateRedisKey('tickets', 'metrics', operation),
  
  performance: (operation) => 
    generateRedisKey('tickets', 'metrics', 'performance', operation),
  
  errors: (operation) => 
    generateRedisKey('tickets', 'metrics', 'errors', operation)
};

/**
 * Logging keys
 */
export const LOG_KEYS = {
  operation: (level = 'info') => 
    generateRedisKey('tickets', 'logs', level),
  
  errors: () => 
    generateRedisKey('tickets', 'logs', 'errors'),
  
  audit: () => 
    generateRedisKey('tickets', 'logs', 'audit')
};

/**
 * Reconciliation keys
 */
export const RECONCILIATION_KEYS = {
  lastRun: (guildId) => 
    generateRedisKey('tickets', 'reconciliation', 'last', guildId),
  
  status: (threadId) => 
    generateRedisKey('tickets', 'reconciliation', 'status', threadId),
  
  queue: () => 
    generateRedisKey('tickets', 'reconciliation', 'queue')
};

/**
 * Sequence keys for incremental IDs
 */
export const SEQUENCE_KEYS = {
  ticketNumber: (guildId) => 
    generateRedisKey('tickets', 'sequence', guildId),
  
  globalTicketNumber: () => 
    generateRedisKey('tickets', 'sequence', 'global')
};

/**
 * Job keys for background tasks
 */
export const JOB_KEYS = {
  reconciliation: () => 
    generateRedisKey('tickets', 'jobs', 'reconciliation'),
  
  cleanup: () => 
    generateRedisKey('tickets', 'jobs', 'cleanup'),
  
  metrics: () => 
    generateRedisKey('tickets', 'jobs', 'metrics')
};

/**
 * Helper function to parse Redis key components
 * @param {string} key - Redis key
 * @returns {Array} Array of key parts
 */
export function parseRedisKey(key) {
  return key.split(':');
}

/**
 * Helper function to extract guild ID from Redis key
 * @param {string} key - Redis key
 * @returns {string|null} Guild ID or null
 */
export function extractGuildId(key) {
  const parts = parseRedisKey(key);
  const guildIndex = parts.findIndex(part => part.match(/^\d{17,19}$/));
  return guildIndex !== -1 ? parts[guildIndex] : null;
}

/**
 * Helper function to extract user ID from Redis key
 * @param {string} key - Redis key
 * @returns {string|null} User ID or null
 */
export function extractUserId(key) {
  const parts = parseRedisKey(key);
  // User IDs are typically the second numeric ID in ticket keys
  const numericParts = parts.filter(part => part.match(/^\d{17,19}$/));
  return numericParts.length >= 2 ? numericParts[1] : null;
}

/**
 * Helper function to extract thread ID from Redis key
 * @param {string} key - Redis key
 * @returns {string|null} Thread ID or null
 */
export function extractThreadId(key) {
  const parts = parseRedisKey(key);
  const threadIndex = parts.findIndex(part => part.match(/^\d{17,19}$/));
  return threadIndex !== -1 ? parts[threadIndex] : null;
}

/**
 * Helper function to get key pattern for wildcard searches
 * @param {string} pattern - Pattern with wildcards (*)
 * @returns {string} Redis pattern for SCAN
 */
export function getPattern(pattern) {
  return pattern.includes('*') ? pattern : `${pattern}*`;
}

/**
 * Helper function to validate Redis key format
 * @param {string} key - Redis key to validate
 * @returns {boolean} True if key is valid
 */
export function isValidKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return false;
  }
  
  // Keys should not contain spaces or control characters
  return !/[\s\x00-\x1F\x7F]/.test(key);
}

/**
 * Helper function to sanitize Redis key
 * @param {string} key - Redis key to sanitize
 * @returns {string} Sanitized key
 */
export function sanitizeKey(key) {
  return key.replace(/[\s\x00-\x1F\x7F]/g, '_');
}
