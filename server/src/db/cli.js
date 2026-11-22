import 'dotenv/config';
import { getMigratorPool, closeAllPools } from './pool.js';
import { migrateUp, migrateDown, getMigrationStatus } from './migrator.js';

const command = process.argv[2] || 'status';
const flag = process.argv[3];

async function main() {
  const pool = getMigratorPool();

  try {
    if (command === 'up') {
      const applied = await migrateUp(pool);
      if (applied.length === 0) {
        console.log('[migrate:up] Database is already up to date.');
      } else {
        console.log(`[migrate:up] Applied ${applied.length} migration(s).`);
      }
    } else if (command === 'down') {
      const all = flag === '--all';
      const steps = !all && flag ? Number(flag) || 1 : 1;
      const rolledBack = await migrateDown(pool, { steps, all });
      if (rolledBack.length === 0) {
        console.log('[migrate:down] No applied migrations to roll back.');
      } else {
        console.log(`[migrate:down] Rolled back ${rolledBack.length} migration(s).`);
      }
    } else if (command === 'reset') {
      await migrateDown(pool, { all: true });
      await migrateUp(pool);
      console.log('[migrate:reset] Database rolled back and re-migrated cleanly.');
    } else if (command === 'status') {
      const statuses = await getMigrationStatus(pool);
      console.table(
        statuses.map((s) => ({
          version: s.version,
          name: s.name,
          status: s.applied ? 'APPLIED' : 'PENDING',
          appliedAt: s.appliedAt ? new Date(s.appliedAt).toISOString() : '-',
        }))
      );
    } else {
      console.error(`Unknown migration command: ${command}`);
      console.error('Usage: node src/db/cli.js [up | down [--all | N] | reset | status]');
      process.exitCode = 1;
    }
  } finally {
    await closeAllPools();
  }
}

main().catch((err) => {
  console.error('[migrate:error]', err.message);
  process.exit(1);
});
