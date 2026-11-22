# Background Job Queue Module (`server/src/modules/jobs`) — T6.8

**Owner:** M2 (Database, Search, Background Jobs)  
**Engine:** `pg-boss` v10 on PostgreSQL (no Redis required)

## Capabilities
- **Retries with backoff:** Failed jobs retry automatically up to `retryLimit` with exponential `retryDelay`.
- **Dead-Letter Queue (DLQ):** Every registered queue `<name>` automatically pairs with `<name>.dlq`. Jobs exhausting retries move into the DLQ for inspection/replay.
- **Scheduled jobs:** Standard 5-field UTC cron schedules persisted in PostgreSQL (`pgboss.schedule`).

## Quick Usage

```js
import { createJobQueue } from './queue.js';
import { registerExampleJobs, registerDefaultSchedules, QUEUES } from './exampleJobs.js';
import { getMigratorPool } from '../../db/pool.js';

const queue = createJobQueue();
await queue.start();
await registerExampleJobs(queue, { pool: getMigratorPool() });
await registerDefaultSchedules(queue);

// Enqueue a one-off job
await queue.enqueue(QUEUES.DEMO_EMAIL, {
  to: 'customer@cutecart.pk',
  template: 'order.confirmed',
});
```

## Consumers
- **M5 (T5.6):** Uses `inventory.release-expired-reservations` and schedules abandoned-cart sweeps.
- **M6 (T7.1 & T6.2):** Uses `enqueue()` for resilient email notifications (Mailpit locally) and scheduled payment reconciliation jobs.

See [SPEC.md](./SPEC.md) for the full 1-page module specification.
