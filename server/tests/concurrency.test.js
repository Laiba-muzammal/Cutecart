import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { withTransaction } from '../src/db/pool.js';
import {
  decrementStockAtomically,
  reserveStockAtomically,
  releaseExpiredReservations,
} from '../src/db/inventoryHelpers.js';
import { createTestPools, ensureMigratedAndSeeded, closeTestPools } from './helpers/testDb.js';
import { TENANTS, STARTER_PRODUCTS } from '../seeds/seedData.js';

describe('T2.6 — Concurrency Safety (Two Buyers Fighting for the Last Unit)', () => {
  let pools;
  const tenantId = TENANTS[0].id;
  const storeId = TENANTS[0].store.id;
  const variantId = STARTER_PRODUCTS[0].variants[1].id; // Lavender Mist / A5

  beforeAll(async () => {
    pools = createTestPools();
    await ensureMigratedAndSeeded(pools.migratorPool);
  });

  afterAll(async () => {
    // Restore stock for subsequent test suites
    await pools.migratorPool.query(
      'UPDATE inventory SET stock_quantity = 30, reserved_quantity = 0 WHERE variant_id = $1',
      [variantId]
    );
    await closeTestPools(pools);
  });

  it('allows exactly 1 of 2 concurrent buyers to claim the last 1 unit, never going negative', async () => {
    // Set stock to exactly 1 unit
    await pools.migratorPool.query(
      'UPDATE inventory SET stock_quantity = 1, reserved_quantity = 0 WHERE variant_id = $1',
      [variantId]
    );

    const attemptBuy = async (buyerName) =>
      withTransaction(pools.migratorPool, async (client) => {
        const res = await decrementStockAtomically(client, {
          tenantId,
          storeId,
          variantId,
          quantity: 1,
        });
        return { buyerName, ...res };
      });

    // Launch two concurrent transactions on separate pooled connections
    const [buyer1, buyer2] = await Promise.all([
      attemptBuy('Buyer-1'),
      attemptBuy('Buyer-2'),
    ]);

    const winners = [buyer1, buyer2].filter((b) => b.success);
    const losers = [buyer1, buyer2].filter((b) => !b.success);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    const { rows } = await pools.migratorPool.query(
      'SELECT stock_quantity, reserved_quantity FROM inventory WHERE variant_id = $1',
      [variantId]
    );
    expect(rows[0].stock_quantity).toBe(0);
    expect(rows[0].reserved_quantity).toBe(0);
  });

  it('reserves stock atomically and releases expired reservations cleanly', async () => {
    await pools.migratorPool.query(
      'UPDATE inventory SET stock_quantity = 5, reserved_quantity = 0 WHERE variant_id = $1',
      [variantId]
    );

    // Reserve 2 units
    const res = await withTransaction(pools.migratorPool, (client) =>
      reserveStockAtomically(client, {
        tenantId,
        storeId,
        variantId,
        quantity: 2,
        ttlMinutes: 15,
      })
    );
    expect(res.success).toBe(true);
    expect(res.inventory.reserved_quantity).toBe(2);

    // Force-expire the reservation to simulate TTL elapsing
    await pools.migratorPool.query(
      `UPDATE inventory_reservations
       SET created_at = NOW() - INTERVAL '20 minutes',
           expires_at = NOW() - INTERVAL '5 minutes'
       WHERE id = $1`,
      [res.reservation.id]
    );

    const released = await withTransaction(pools.migratorPool, (client) =>
      releaseExpiredReservations(client)
    );
    expect(released.expiredCount).toBeGreaterThanOrEqual(1);
    expect(released.releasedUnits).toBeGreaterThanOrEqual(2);

    const { rows } = await pools.migratorPool.query(
      'SELECT stock_quantity, reserved_quantity FROM inventory WHERE variant_id = $1',
      [variantId]
    );
    expect(rows[0].stock_quantity).toBe(5);
    expect(rows[0].reserved_quantity).toBe(0);
  });
});
