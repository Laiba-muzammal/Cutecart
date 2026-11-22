import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createJobQueue } from '../src/modules/jobs/queue.js';
import { registerExampleJobs, registerDefaultSchedules, QUEUES } from '../src/modules/jobs/exampleJobs.js';
import { createTestPools, ensureMigratedAndSeeded, closeTestPools } from './helpers/testDb.js';

function waitUntil(predicate, { timeoutMs = 15000, intervalMs = 150 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(async () => {
      try {
        const result = await predicate();
        if (result) {
          clearInterval(timer);
          resolve(result);
        } else if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for job condition`));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

describe('T6.8 — Background Job Queue (pg-boss on PostgreSQL, no Redis)', () => {
  let pools;
  let queue;

  beforeAll(async () => {
    pools = createTestPools();
    await ensureMigratedAndSeeded(pools.migratorPool);

    queue = createJobQueue({
      connectionString: process.env.DATABASE_URL,
      schema: 'pgboss',
      defaultRetryLimit: 1,
      defaultRetryDelay: 1,
      logger: null,
    });
    await queue.start();
  });

  afterAll(async () => {
    if (queue) await queue.stop();
    await closeTestPools(pools);
  });

  it('processes an example job, registers cron schedules, and handles retries + Dead-Letter Queue', async () => {
    const heartbeats = [];
    await registerExampleJobs(queue, {
      pool: pools.migratorPool,
      onHeartbeat: (payload) => heartbeats.push(payload),
      logger: null,
    });
    await registerDefaultSchedules(queue);

    // 1. Verify example job runs
    const hbId = await queue.enqueue(QUEUES.HEARTBEAT, { source: 'vitest' });
    expect(hbId).toBeTruthy();

    await waitUntil(() => heartbeats.some((h) => h.source === 'vitest'));
    expect(heartbeats.some((h) => h.source === 'vitest')).toBe(true);

    // 2. Verify recurring schedules are persisted in PostgreSQL
    const schedRes = await pools.migratorPool.query(
      `SELECT name, cron FROM pgboss.schedule WHERE name = ANY($1::text[])`,
      [[QUEUES.HEARTBEAT, QUEUES.RELEASE_EXPIRED_RESERVATIONS]]
    );
    expect(schedRes.rows.length).toBe(2);

    // 3. Verify retries + Dead-Letter Queue routing when a job permanently fails
    const dlqTestQueue = 'test.retry-and-dlq';
    let attempts = 0;
    await queue.work(
      dlqTestQueue,
      async () => {
        attempts += 1;
        throw new Error(`Forced failure attempt #${attempts}`);
      },
      {
        pollingIntervalSeconds: 0.5,
        queuePolicy: { retryLimit: 1, retryDelay: 1, retryBackoff: false, enableDeadLetter: true },
      }
    );

    await queue.enqueue(
      dlqTestQueue,
      { orderId: 'demo-dlq-order' },
      { retryLimit: 1, retryDelay: 1, retryBackoff: false }
    );

    // Wait until initial attempt + 1 retry both fail and job lands in `<queue>.dlq`
    const dlqJobs = await waitUntil(async () => {
      const found = await queue.fetchDeadLetterJobs(dlqTestQueue);
      return found.length > 0 ? found : false;
    });

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(dlqJobs.length).toBeGreaterThanOrEqual(1);
    expect(dlqJobs[0].data).toEqual({ orderId: 'demo-dlq-order' });
  });
});
