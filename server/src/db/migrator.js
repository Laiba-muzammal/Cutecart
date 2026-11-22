import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

const MIGRATION_LOCK_KEY = 42026002; // Advisory lock key to prevent concurrent migrations

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function listMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  const entries = await fs.readdir(migrationsDir);
  const upFiles = entries
    .filter((f) => f.endsWith('.up.sql'))
    .sort((a, b) => a.localeCompare(b));

  return upFiles.map((upFile) => {
    const base = upFile.replace(/\.up\.sql$/, '');
    const version = base.split('_')[0];
    const downFile = `${base}.down.sql`;
    return {
      version,
      name: base,
      upPath: path.join(migrationsDir, upFile),
      downPath: path.join(migrationsDir, downFile),
    };
  });
}

export async function getMigrationStatus(pool, migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC'
    );
    const appliedMap = new Map(rows.map((r) => [r.version, r]));
    const files = await listMigrationFiles(migrationsDir);

    return files.map((m) => ({
      version: m.version,
      name: m.name,
      applied: appliedMap.has(m.version),
      appliedAt: appliedMap.get(m.version)?.applied_at ?? null,
    }));
  } finally {
    client.release();
  }
}

export async function migrateUp(pool, { migrationsDir = DEFAULT_MIGRATIONS_DIR, logger = console } = {}) {
  const client = await pool.connect();
  const appliedNow = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await ensureMigrationsTable(client);

    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(rows.map((r) => r.version));
    const files = await listMigrationFiles(migrationsDir);

    for (const migration of files) {
      if (appliedSet.has(migration.version)) {
        continue;
      }

      const sql = await fs.readFile(migration.upPath, 'utf8');
      await client.query('BEGIN');
      try {
        // Inject configured role passwords safely via transaction-local settings (for migration 003)
        if (process.env.APP_DB_ROLE_PASSWORD) {
          await client.query("SELECT set_config('app.role_app_password', $1, true)", [
            process.env.APP_DB_ROLE_PASSWORD,
          ]);
        }
        if (process.env.READONLY_DB_ROLE_PASSWORD) {
          await client.query("SELECT set_config('app.role_readonly_password', $1, true)", [
            process.env.READONLY_DB_ROLE_PASSWORD,
          ]);
        }

        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
        await client.query('COMMIT');
        appliedNow.push(migration.name);
        logger?.info?.(`[migrate:up] Applied ${migration.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration UP failed on ${migration.name}: ${err.message}`, { cause: err });
      }
    }

    return appliedNow;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    } catch {
      // ignore unlock error if connection dropped
    }
    client.release();
  }
}

export async function migrateDown(
  pool,
  { steps = 1, all = false, migrationsDir = DEFAULT_MIGRATIONS_DIR, logger = console } = {}
) {
  const client = await pool.connect();
  const rolledBack = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await ensureMigrationsTable(client);

    const { rows } = await client.query(
      'SELECT version, name FROM schema_migrations ORDER BY version DESC'
    );
    const files = await listMigrationFiles(migrationsDir);
    const fileMap = new Map(files.map((f) => [f.version, f]));

    const targets = all ? rows : rows.slice(0, steps);

    for (const row of targets) {
      const migration = fileMap.get(row.version);
      if (!migration) {
        throw new Error(`Down migration file not found for version ${row.version} (${row.name})`);
      }

      const sql = await fs.readFile(migration.downPath, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('DELETE FROM schema_migrations WHERE version = $1', [row.version]);
        await client.query('COMMIT');
        rolledBack.push(migration.name);
        logger?.info?.(`[migrate:down] Rolled back ${migration.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration DOWN failed on ${migration.name}: ${err.message}`, { cause: err });
      }
    }

    return rolledBack;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    } catch {
      // ignore
    }
    client.release();
  }
}
