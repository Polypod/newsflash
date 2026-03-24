// ecosystem.config.js — PM2 process config for VPS production
// Usage: pm2 start ecosystem.config.js --env production
//
// Set APP_DIR to the repo root on your VPS, e.g.:
//   export APP_DIR=/opt/newsflash && pm2 start ecosystem.config.js --env production

const APP_DIR = process.env.APP_DIR || '/opt/newsflash';

module.exports = {
  apps: [
    {
      name: 'newsflash-backend',
      cwd: `${APP_DIR}/backend`,
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/newsflash/backend-error.log',
      out_file: '/var/log/newsflash/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'newsflash-ai',
      cwd: `${APP_DIR}/ai-service`,
      script: `${APP_DIR}/ai-service/.venv/bin/uvicorn`,
      args: 'src.main:app --host 127.0.0.1 --port 8000 --workers 2',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        ENVIRONMENT: 'production',
        PYTHONPATH: `${APP_DIR}/ai-service/src`,
      },
      error_file: '/var/log/newsflash/ai-error.log',
      out_file: '/var/log/newsflash/ai-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
