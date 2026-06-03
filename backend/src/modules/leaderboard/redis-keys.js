const PREFIX = {
  messages: 'messages',
  active: 'active_users',
  leaderboard: 'leaderboard',
  worker: 'worker'
};

export const REDIS_KEYS = {
  leaderboardChannel: 'leaderboard:channel',
  workerHeartbeat: 'worker:heartbeat',
  workerResetHeartbeat: 'worker:reset:heartbeat',
  workerLastSync: 'worker:last_sync',
  workerLastLeaderboardUpdate: 'worker:last_leaderboard_update'
};

export const BUCKETS = Object.freeze(['monthly', 'weekly', 'daily']);

export const HEARTBEAT_TTL_SECONDS = 1200;
export const HEARTBEAT_TTL_MS = HEARTBEAT_TTL_SECONDS * 1000;

export const FORCE_UPDATE_COOLDOWN_MS = 30000;

export function activeUsersKey(bucket) {
  return `${PREFIX.active}:${bucket}`;
}

export function activeUsersSyncingKey(bucket) {
  return `${PREFIX.active}:${bucket}:syncing`;
}

export function messagesKey(bucket, userId) {
  return `${PREFIX.messages}:${bucket}:${userId}`;
}

export function leaderboardMsgKey(bucket) {
  return `${PREFIX.leaderboard}:msg:${bucket}`;
}
