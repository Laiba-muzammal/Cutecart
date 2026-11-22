import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { createTestPools, ensureMigratedAndSeeded, closeTestPools } from './helpers/testDb.js';
import { runSeed } from '../seeds/seed.js';
import { migrateLegacyUsers } from '../scripts/migrate-mongo-users.js';
import { runExplainSuite } from '../scripts/explain-queries.js';

describe('T2.4, T2.5 & T2.7 — Seed Idempotency, Legacy User Migration & EXPLAIN Index Proof', () => {
  let pools;

  beforeAll(async () => {
    pools = createTestPools();
    await ensureMigratedAndSeeded(pools.migratorPool);
  });

  afterAll(async () => {
    await closeTestPools(pools);
  });

  it('runs npm run seed twice idempotently with 4 tenants and all 4 roles', async () => {
    await runSeed(pools.migratorPool, { logger: null });
    const countsFirst = await pools.migratorPool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM tenants) AS tenants,
        (SELECT COUNT(*)::int FROM stores) AS stores,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM products) AS products,
        (SELECT COUNT(*)::int FROM orders) AS orders
    `);

    // Second run must produce identical counts with zero errors
    await runSeed(pools.migratorPool, { logger: null });
    const countsSecond = await pools.migratorPool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM tenants) AS tenants,
        (SELECT COUNT(*)::int FROM stores) AS stores,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM products) AS products,
        (SELECT COUNT(*)::int FROM orders) AS orders
    `);

    expect(countsFirst.rows[0].tenants).toBe(4);
    expect(countsFirst.rows[0].stores).toBe(4);
    expect(countsSecond.rows[0]).toEqual(countsFirst.rows[0]);

    // Verify all 4 platform roles exist in memberships
    const rolesRes = await pools.migratorPool.query(
      'SELECT DISTINCT role::text AS role FROM memberships ORDER BY role ASC'
    );
    expect(rolesRes.rows.map((r) => r.role)).toEqual([
      'customer',
      'platform_admin',
      'seller',
      'staff',
    ]);
  });

  it('migrates legacy MongoDB users idempotently and flags cost-10 hashes for rehash (T2.7)', async () => {
    const legacyCost10Hash = await bcrypt.hash('oldpass123', 10);
    const records = [
      { username: 'mongo_legacy_alice', password: legacyCost10Hash },
    ];

    const dry = await migrateLegacyUsers(pools.migratorPool, records, { dryRun: true, testMode: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.preview[0].needsPasswordRehash).toBe(true);

    const first = await migrateLegacyUsers(pools.migratorPool, records, { testMode: true });
    expect(first.inserted).toBe(1);

    const second = await migrateLegacyUsers(pools.migratorPool, records, { testMode: true });
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(1);

    const { rows } = await pools.migratorPool.query(
      'SELECT email, username, password_hash, needs_password_rehash FROM users WHERE username = $1',
      ['mongo_legacy_alice']
    );
    expect(rows[0].email).toBe('mongo_legacy_alice@migrated.cutecart.local');
    expect(rows[0].needs_password_rehash).toBe(true);
    expect(await bcrypt.compare('oldpass123', rows[0].password_hash)).toBe(true);
  });

  it('verifies all 10 production queries with real EXPLAIN (ANALYZE, BUFFERS) index plans (T2.5)', async () => {
    const results = await runExplainSuite(pools.migratorPool, { writeDoc: true });
    expect(results).toHaveLength(10);
    for (const r of results) {
      expect(r.indexVerified, `Expected index ${r.expectedIndex} to be verified for ${r.id}`).toBe(
        true
      );
    }
  });
});
