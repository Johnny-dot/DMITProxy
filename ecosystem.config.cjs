/** @type {import('pm2').StartOptions} */
const path = require('node:path');

const projectRoot = __dirname;
const logsDir = path.join(projectRoot, 'logs');
const subconverterDir = path.join(projectRoot, 'vendor/subconverter');

module.exports = {
  apps: [
    {
      name: 'dmit-proxy',
      script: 'node',
      args: '--import tsx/esm server/index.ts',
      cwd: projectRoot,
      instances: 1,
      exec_mode: 'fork',

      // Environment
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: '3001',
      },

      // Restart policy
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 2000,

      // Logs (logrotate handles rotation via `pm2 install pm2-logrotate`)
      out_file: path.join(logsDir, 'out.log'),
      error_file: path.join(logsDir, 'error.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful shutdown: wait up to 10s for SIGTERM before SIGKILL
      kill_timeout: 10000,
      listen_timeout: 8000,
    },
    {
      // Subscription format converter sidecar (Clash / sing-box / Surge).
      // Installed by scripts/install-subconverter.sh; binds to 127.0.0.1:25500.
      name: 'dmit-subconverter',
      script: path.join(subconverterDir, 'subconverter'),
      cwd: subconverterDir,
      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 2000,

      out_file: path.join(logsDir, 'subconverter.out.log'),
      error_file: path.join(logsDir, 'subconverter.error.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      kill_timeout: 5000,
    },
  ],
};
