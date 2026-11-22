import 'dotenv/config';
import { createPool } from '../../src/db/pool.js';
import { migrateUp } from '../../src/db/migrator.js';
import { runSeed } from '../../seeds/seed.js';

export function createTestPools() {
  const migratorPool = createPool({ role: 'migrator' });
  const appPool = createPool({ role: 'app' });
  const readonlyPool = createPool({ role: 'readonly' });
  return { migratorPool, appPool, readonlyPool };
}

export async function ensureMigratedAndSeeded(migratorPool) {
  await migrateUp(migratorPool, { logger: null });
  await runSeed(migratorPool, { logger: null });
}

export async function closeTestPools({ migratorPool, appPool, readonlyPool }) {
  await Promise.all([
    migratorPool?.end(),
    appPool?.end(),
    readonlyPool?.end(),
  ]);
}
