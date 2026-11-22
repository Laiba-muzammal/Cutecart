import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool } from '../src/db/pool.js';
import { migrateUp, migrateDown, getMigrationStatus } from '../src/db/migrator.js';

const EXPECTED_TABLES = [
  'tenants',
  'users',
  'user_sessions',
  'memberships',
  'stores',
  'categories',
  'products',
  'variants',
  'inventory',
  'inventory_reservations',
  'carts',
  'cart_items',
  'coupons',
  'orders',
  'order_items',
  'order_status_history',
  'payments',
  'shipments',
  'refunds',
  'reviews',
  'wishlist',
  'addresses',
  'notifications',
  'audit_log',
];

describe('T2.2 & T2.6 — Migrations Up and Down', () => {
  let pool;

  beforeAll(() => {
    pool = createPool({ role: 'migrator' });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('runs all migrations down cleanly, then up cleanly, creating all 24 tables', async () => {
    // Ensure we start from a clean slate by rolling back any prior state
    await migrateUp(pool, { logger: null });
    const rolledBack = await migrateDown(pool, { all: true, logger: null });
    expect(rolledBack.length).toBeGreaterThanOrEqual(4);

    // Verify all domain tables are removed after full down migration
    const afterDown = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
      [EXPECTED_TABLES]
    );
    expect(afterDown.rows).toHaveLength(0);

    // Re-apply all migrations up
    const applied = await migrateUp(pool, { logger: null });
    expect(applied).toHaveLength(4);

    // Verify all 22 core tables + 2 operational support tables exist
    const afterUp = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
      [EXPECTED_TABLES]
    );
    const createdNames = afterUp.rows.map((r) => r.tablename).sort();
    expect(createdNames).toEqual([...EXPECTED_TABLES].sort());

    // Running migrateUp a second time is a safe no-op
    const secondRun = await migrateUp(pool, { logger: null });
    expect(secondRun).toHaveLength(0);

    const status = await getMigrationStatus(pool);
    expect(status.every((s) => s.applied)).toBe(true);
  });
});
