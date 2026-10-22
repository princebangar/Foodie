/**
 * PM2 ecosystem for Foodie API + BullMQ workers.
 *
 * Usage (on live server, from Backend folder):
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * Safe rules:
 * - Start Redis BEFORE enabling REDIS_ENABLED / BULLMQ_ENABLED in .env
 * - API never crashes if Redis blips (queues degrade gracefully)
 * - Workers wait for Redis, then exit 0 (not 1) so PM2 doesn't hard crash-loop
 */
module.exports = {
  apps: [
    {
      name: 'foodie-v2',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      // server.js waits up to 10s for in-flight requests (orders, payments, refunds) on SIGINT;
      // PM2's default 1.6s SIGKILL cut them off mid-way.
      kill_timeout: 12000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'foodie-worker-order',
      script: 'src/queues/workers/order.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'foodie-worker-payment',
      script: 'src/queues/workers/payment.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'foodie-worker-notification',
      script: 'src/queues/workers/notification.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'foodie-worker-tracking',
      script: 'src/queues/workers/tracking.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'foodie-worker-otp',
      script: 'src/queues/workers/otp.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
