module.exports = {
  apps: [
    {
      name: 'aoi-bot',
      script: 'backend/src/main.ts',
      interpreter: 'bun',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'leaderboard-sync',
      script: 'backend/src/modules/leaderboard/sync-worker.ts',
      interpreter: 'bun',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'leaderboard-reset',
      script: 'backend/src/modules/leaderboard/reset-worker.ts',
      interpreter: 'bun',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
