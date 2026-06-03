module.exports = {
  apps: [
    {
      name: 'aoi-bot',
      script: 'backend/src/main.js',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'leaderboard-sync',
      script: 'backend/src/modules/leaderboard/sync-worker.js',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'leaderboard-reset',
      script: 'backend/src/modules/leaderboard/reset-worker.js',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
