import { withTransaction } from '../../db/pool.js';
import { releaseExpiredReservations } from '../../db/inventoryHelpers.js';

export const QUEUES = {
  HEARTBEAT: 'system.heartbeat',
  RELEASE_EXPIRED_RESERVATIONS: 'inventory.release-expired-reservations',
  DEMO_EMAIL: 'notifications.demo-email',
};

/**
 * Register built-in example and core maintenance workers on the pg-boss queue (T6.8).
 * Demonstrates:
 *  1. Scheduled recurring job (`system.heartbeat`)
 *  2. Real transactional database maintenance job (`inventory.release-expired-reservations` for M5 T5.6)
 *  3. Retry + Dead-Letter Queue job (`notifications.demo-email` template for M6 T7.1)
 */
export async function registerExampleJobs(queue, { pool, onHeartbeat, logger = console } = {}) {
  // 1. Example scheduled heartbeat job
  await queue.work(QUEUES.HEARTBEAT, async (job) => {
    const payload = {
      jobId: job.id,
      timestamp: new Date().toISOString(),
      source: job.data?.source || 'schedule',
    };
    if (onHeartbeat) {
      await onHeartbeat(payload);
    } else {
      logger?.info?.('[jobs:heartbeat]', payload);
    }
  });

  // 2. Real inventory reservation expiry sweeper (used by M5 T5.6)
  if (pool) {
    await queue.work(QUEUES.RELEASE_EXPIRED_RESERVATIONS, async () => {
      const result = await withTransaction(pool, (client) => releaseExpiredReservations(client));
      if (result.expiredCount > 0) {
        logger?.info?.('[jobs:reservations] Released expired reservations:', result);
      }
      return result;
    });
  }

  // 3. Example notification worker demonstrating automatic retry & DLQ behavior
  await queue.work(QUEUES.DEMO_EMAIL, async (job) => {
    if (job.data?.simulateFailure) {
      throw new Error(`Simulated SMTP failure for recipient ${job.data?.to || 'unknown'}`);
    }
    logger?.info?.(`[jobs:demo-email] Dispatched email template=${job.data?.template} to=${job.data?.to}`);
  });
}

/**
 * Install default recurring schedules (idempotent in pg-boss).
 */
export async function registerDefaultSchedules(queue) {
  await queue.schedule(QUEUES.HEARTBEAT, '*/5 * * * *', { source: 'cron' });
  await queue.schedule(QUEUES.RELEASE_EXPIRED_RESERVATIONS, '* * * * *', { source: 'cron' });
}
