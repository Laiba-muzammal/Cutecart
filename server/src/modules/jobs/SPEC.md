# Module Specification: Background Job Queue (`server/src/modules/jobs`)

**Owner:** M2  
**Task:** T6.8 (Background Job Queue)

---

## 1. Design Decision: `pg-boss` on PostgreSQL (No Redis)

CuteCart runs a modular monolith backed by PostgreSQL. Introducing Redis solely for background jobs would add operational complexity, a second backup/HA surface, and split transactional boundaries. `pg-boss` uses PostgreSQL's `SKIP LOCKED` semantics inside an isolated `pgboss` schema, guaranteeing at-least-once delivery with zero extra infrastructure.

---

## 2. Queue Lifecycle & Reliability Guarantees

1. **Provisioning (`ensureQueue`):** Before enqueueing or polling, `JobQueue.ensureQueue(name)` creates `<name>.dlq` (with `retryLimit: 0`) and `<name>` linked via `deadLetter: '<name>.dlq'`.
2. **Retries & Backoff:** Default policy is `retryLimit = 3`, `retryDelay = 30s`, `retryBackoff = true`, configurable per queue or per job.
3. **Dead-Letter Queue (DLQ):** When a job fails after exhausting all retries, `pg-boss` moves it atomically to `<name>.dlq`. Operators can inspect DLQ entries via `fetchDeadLetterJobs(name)` and monitor depths via `getQueueStats(pool, name)`.
4. **Scheduled / Cron Jobs:** `queue.schedule(name, cron, data)` stores recurring schedules in UTC.
5. **Idempotency:** Callers may pass `singletonKey` (e.g., `order-confirmed:<orderId>`) so duplicate triggers never enqueue duplicate notifications.

---

## 3. Built-in Jobs & Team Handoffs

| Queue Name | Type | Owner / Consumer | Purpose |
|---|---|---|---|
| `system.heartbeat` | Cron (`*/5 * * * *`) | M2 | Example scheduled health/liveness job |
| `inventory.release-expired-reservations` | Cron (`* * * * *`) | M2 -> M5 (T5.6) | Atomically expires checkout holds past `expires_at` and restores `inventory.reserved_quantity` |
| `notifications.demo-email` | On-demand | M2 -> M6 (T7.1) | Template worker showing retry & DLQ behavior for email/in-app notifications |

---

## 4. Operational Notes
- Schema `pgboss` is managed automatically by `boss.start()` under `DATABASE_URL` (migrator role) or a dedicated worker role with privileges on schema `pgboss`.
- Always call `await queue.stop()` on `SIGINT`/`SIGTERM` so in-flight jobs finish gracefully.
- Verified by `server/tests/jobs.test.js` (enqueue, execution, automatic retry, DLQ routing, scheduled cron registration, and expired reservation release).
