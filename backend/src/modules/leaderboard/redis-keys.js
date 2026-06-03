export const REDIS_KEYS = {
  messagesDaily: (userId) => `messages:daily:${userId}`,
  messagesWeekly: (userId) => `messages:weekly:${userId}`,
  messagesMonthly: (userId) => `messages:monthly:${userId}`,
  activeUsersDaily: 'active_users:daily',
  activeUsersWeekly: 'active_users:weekly',
  activeUsersMonthly: 'active_users:monthly',
  activeUsersDailySyncing: 'active_users:daily:syncing',
  activeUsersWeeklySyncing: 'active_users:weekly:syncing',
  activeUsersMonthlySyncing: 'active_users:monthly:syncing',
  leaderboardMsgDaily: 'leaderboard:msg:daily',
  leaderboardMsgWeekly: 'leaderboard:msg:weekly',
  leaderboardMsgMonthly: 'leaderboard:msg:monthly',
  leaderboardChannel: 'leaderboard:channel',
  workerHeartbeat: 'worker:heartbeat',
  workerLastSync: 'worker:last_sync',
  workerLastLeaderboardUpdate: 'worker:last_leaderboard_update'
};

export const BUCKETS = ['daily', 'weekly', 'monthly'];

export function activeUsersKey(bucket) {
  return `active_users:${bucket}`;
}

export function activeUsersSyncingKey(bucket) {
  return `active_users:${bucket}:syncing`;
}

export function messagesKey(bucket, userId) {
  return `messages:${bucket}:${userId}`;
}

export function leaderboardMsgKey(bucket) {
  return `leaderboard:msg:${bucket}`;
}
