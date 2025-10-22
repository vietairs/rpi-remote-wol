module.exports = {
  apps: [
    {
      name: 'PC Remote Wake on Lan',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M', // Restart if memory exceeds 300MB
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Restart strategy for long-running process stability
      min_uptime: '10s', // Consider app online after 10 seconds
      max_restarts: 10, // Max restarts within 1 minute

      // Kill timeout - give app 10 seconds to gracefully shutdown
      kill_timeout: 10000,

      // Scheduled restart to prevent resource accumulation and stalling
      // Restarts daily at 3 AM (background maintenance handles DB optimization)
      cron_restart: '0 3 * * *', // Daily at 3:00 AM
    },
  ],
};
