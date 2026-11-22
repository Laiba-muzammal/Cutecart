import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Keep NUMERIC(12,2) as exact decimal strings (never JS float) — shared API rule
pg.types.setTypeParser(1700, (val) => val);

/**
 * Build pool configuration tuned for CuteCart PostgreSQL workloads (T2.5).
 */
export function buildPoolConfig({ connectionString, role = 'migrator' } = {}) {
  const defaultUrl =
    role === 'app'
      ? process.env.APP_DATABASE_URL || process.env.DATABASE_URL
      : role === 'readonly'
        ? process.env.READONLY_DATABASE_URL || process.env.DATABASE_URL
        : process.env.DATABASE_URL;

  const url = connectionString || defaultUrl;
  if (!url) {
    throw new Error(
      `Missing PostgreSQL connection string for role="${role}". Set DATABASE_URL (and APP_DATABASE_URL) in .env.`
    );
  }

  const statementTimeoutMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS || 10000);

  return {
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX || 20),
    min: Number(process.env.DB_POOL_MIN || 2),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || 5000),
    allowExitOnIdle: process.env.NODE_ENV === 'test',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    options: `-c statement_timeout=${statementTimeoutMs} -c timezone=UTC`,
  };
}

let migratorPool = null;
let appPool = null;

export function createPool(options = {}) {
  const pool = new Pool(buildPoolConfig(options));
  pool.on('error', (err) => {
    console.error('[db:pool] Unexpected idle client error:', err.message);
  });
  return pool;
}

export function getMigratorPool() {
  if (!migratorPool) {
    migratorPool = createPool({ role: 'migrator' });
  }
  return migratorPool;
}

export function getAppPool() {
  if (!appPool) {
    appPool = createPool({ role: 'app' });
  }
  return appPool;
}

export async function closeAllPools() {
  const closing = [];
  if (migratorPool) {
    closing.push(migratorPool.end());
    migratorPool = null;
  }
  if (appPool) {
    closing.push(appPool.end());
    appPool = null;
  }
  await Promise.all(closing);
}

/**
 * Execute work inside a PostgreSQL transaction with automatic COMMIT/ROLLBACK.
 */
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore secondary rollback failure
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute work inside a transaction with transaction-local PostgreSQL RLS context.
 * Uses set_config(..., true) (SET LOCAL) so pooled connections NEVER leak tenant context
 * to subsequent requests.
 *
 * @param {import('pg').Pool} pool - Preferably the least-privilege cutecart_app pool.
 * @param {{ tenantId?: string|null, storeId?: string|null, userId?: string|null, guestToken?: string|null, role?: 'anonymous'|'customer'|'staff'|'seller'|'platform_admin' }} ctx
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTenantContext(pool, ctx = {}, fn) {
  const {
    tenantId = '',
    storeId = '',
    userId = '',
    guestToken = '',
    role = 'anonymous',
  } = ctx;

  return withTransaction(pool, async (client) => {
    await client.query(
      `SELECT
        set_config('app.current_tenant_id', $1, true),
        set_config('app.current_store_id', $2, true),
        set_config('app.current_user_id', $3, true),
        set_config('app.current_guest_token', $4, true),
        set_config('app.current_role', $5, true)`,
      [
        tenantId ? String(tenantId) : '',
        storeId ? String(storeId) : '',
        userId ? String(userId) : '',
        guestToken ? String(guestToken) : '',
        String(role),
      ]
    );
    return fn(client);
  });
}

/**
 * Health check helper (used by /api/health — T1.6).
 */
export async function checkDatabaseHealth(pool = getAppPool()) {
  const start = Date.now();
  const res = await pool.query('SELECT 1 AS ok, NOW() AT TIME ZONE \'UTC\' AS utc_now');
  return {
    ok: res.rows[0]?.ok === 1,
    latencyMs: Date.now() - start,
    utcNow: res.rows[0]?.utc_now,
  };
}
