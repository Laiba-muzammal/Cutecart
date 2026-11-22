import PgBoss from 'pg-boss';

/**
 * CuteCart Background Job Queue powered by pg-boss (PostgreSQL-backed, zero Redis) — T6.8.
 *
 * Features:
 * - Automatic retries with exponential backoff
 * - First-class Dead-Letter Queue (DLQ) per queue (`<queueName>.dlq`)
 * - Scheduled / cron recurring jobs
 * - Safe graceful start & shutdown
 */
export class JobQueue {
  constructor({
    connectionString = process.env.DATABASE_URL,
    schema = process.env.PGBOSS_SCHEMA || 'pgboss',
    defaultRetryLimit = Number(process.env.PGBOSS_RETRY_LIMIT || 3),
    defaultRetryDelay = Number(process.env.PGBOSS_RETRY_DELAY_SECONDS || 30),
    logger = console,
  } = {}) {
    if (!connectionString) {
      throw new Error('JobQueue requires a PostgreSQL connectionString (DATABASE_URL).');
    }

    this.schema = schema;
    this.defaultRetryLimit = defaultRetryLimit;
    this.defaultRetryDelay = defaultRetryDelay;
    this.logger = logger;
    this.started = false;
    this.registeredQueues = new Set();

    this.boss = new PgBoss({
      connectionString,
      schema,
      monitorStateIntervalSeconds: 60,
    });

    this.boss.on('error', (err) => {
      this.logger?.error?.('[jobs:pg-boss] Error:', err.message);
    });
  }

  async start() {
    if (this.started) return this;
    await this.boss.start();
    this.started = true;
    return this;
  }

  async stop() {
    if (!this.started) return;
    await this.boss.stop({ graceful: true, timeout: 5000 });
    this.started = false;
    this.registeredQueues.clear();
  }

  /**
   * Ensure both a primary queue and its paired dead-letter queue exist.
   */
  async ensureQueue(
    queueName,
    {
      retryLimit = this.defaultRetryLimit,
      retryDelay = this.defaultRetryDelay,
      retryBackoff = true,
      expireInSeconds = 300,
      enableDeadLetter = true,
    } = {}
  ) {
    if (!this.started) {
      await this.start();
    }

    const dlqName = `${queueName}.dlq`;
    if (enableDeadLetter && !this.registeredQueues.has(dlqName)) {
      await this.boss.createQueue(dlqName, { retryLimit: 0 });
      this.registeredQueues.add(dlqName);
    }

    if (!this.registeredQueues.has(queueName)) {
      await this.boss.createQueue(queueName, {
        retryLimit,
        retryDelay,
        retryBackoff,
        expireInSeconds,
        ...(enableDeadLetter ? { deadLetter: dlqName } : {}),
      });
      this.registeredQueues.add(queueName);
    }

    return { queueName, dlqName: enableDeadLetter ? dlqName : null };
  }

  /**
   * Enqueue a background job with retries and DLQ routing.
   */
  async enqueue(queueName, data = {}, options = {}) {
    await this.ensureQueue(queueName, options.queuePolicy);
    return this.boss.send(queueName, data, {
      retryLimit: options.retryLimit ?? this.defaultRetryLimit,
      retryDelay: options.retryDelay ?? this.defaultRetryDelay,
      retryBackoff: options.retryBackoff ?? true,
      singletonKey: options.singletonKey,
      startAfter: options.startAfter,
    });
  }

  /**
   * Register a recurring cron job (e.g., '* * * * *' for reservation expiry).
   */
  async schedule(queueName, cronExpression, data = {}, options = {}) {
    await this.ensureQueue(queueName, options.queuePolicy);
    await this.boss.schedule(queueName, cronExpression, data, {
      tz: options.tz || 'UTC',
      retryLimit: options.retryLimit ?? this.defaultRetryLimit,
      retryDelay: options.retryDelay ?? this.defaultRetryDelay,
      retryBackoff: options.retryBackoff ?? true,
    });
    return { queueName, cronExpression };
  }

  /**
   * Register a worker handler for a queue.
   * Wraps pg-boss v10's array batch signature so callers handle one job cleanly.
   */
  async work(queueName, handler, options = {}) {
    await this.ensureQueue(queueName, options.queuePolicy);
    return this.boss.work(
      queueName,
      {
        batchSize: options.batchSize ?? 1,
        pollingIntervalSeconds: options.pollingIntervalSeconds ?? 1,
      },
      async (jobs) => {
        for (const job of jobs) {
          await handler(job);
        }
      }
    );
  }

  /**
   * Fetch pending jobs currently sitting in the dead-letter queue for inspection or replay.
   */
  async fetchDeadLetterJobs(queueName, { batchSize = 20 } = {}) {
    const dlqName = `${queueName}.dlq`;
    await this.ensureQueue(queueName);
    const jobs = await this.boss.fetch(dlqName, { batchSize });
    return jobs || [];
  }

  /**
   * Return queue depth counts (created/retry/active/completed/failed) plus DLQ size.
   */
  async getQueueStats(pool, queueName) {
    const dlqName = `${queueName}.dlq`;
    const { rows } = await pool.query(
      `SELECT name, state, COUNT(*)::int AS count
       FROM ${this.schema}.job
       WHERE name = ANY($1::text[])
       GROUP BY name, state`,
      [[queueName, dlqName]]
    );

    const summary = { queue: queueName, dlq: dlqName, states: {}, dlqCount: 0 };
    for (const row of rows) {
      if (row.name === dlqName) {
        summary.dlqCount += row.count;
      } else {
        summary.states[row.state] = row.count;
      }
    }
    return summary;
  }
}

export function createJobQueue(options) {
  return new JobQueue(options);
}
