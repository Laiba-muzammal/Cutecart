import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { withTenantContext } from '../src/db/pool.js';
import { createTestPools, ensureMigratedAndSeeded, closeTestPools } from './helpers/testDb.js';
import { TENANTS, USERS, CATEGORIES, STARTER_PRODUCTS } from '../seeds/seedData.js';

describe('T2.3 & T2.6 — Tenant Isolation via Real Access Path (cutecart_app + FORCE RLS)', () => {
  let pools;

  beforeAll(async () => {
    pools = createTestPools();
    await ensureMigratedAndSeeded(pools.migratorPool);
  });

  afterAll(async () => {
    await closeTestPools(pools);
  });

  it('prevents Seller A from reading, updating, or inserting into Store B orders/products/coupons/audit_log', async () => {
    const sellerACtx = {
      tenantId: TENANTS[0].id,
      storeId: TENANTS[0].store.id,
      userId: USERS[1].id,
      role: 'seller',
    };

    const result = await withTenantContext(pools.appPool, sellerACtx, async (client) => {
      const orders = await client.query('SELECT id, store_id FROM orders');
      const coupons = await client.query('SELECT id, store_id FROM coupons');
      const audits = await client.query('SELECT id, store_id FROM audit_log');

      // Direct targeted read of Store B's order by UUID must return 0 rows
      const crossRead = await client.query(
        'SELECT id FROM orders WHERE id = $1',
        ['80000000-0000-4000-8000-000000000002']
      );

      // Direct targeted update of Store B's order must affect 0 rows
      const crossUpdate = await client.query(
        `UPDATE orders SET notes = 'hijacked' WHERE id = $1`,
        ['80000000-0000-4000-8000-000000000002']
      );

      return {
        orders: orders.rows,
        coupons: coupons.rows,
        audits: audits.rows,
        crossReadCount: crossRead.rowCount,
        crossUpdateCount: crossUpdate.rowCount,
      };
    });

    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders.every((o) => o.store_id === TENANTS[0].store.id)).toBe(true);
    expect(result.coupons.every((c) => c.store_id === TENANTS[0].store.id)).toBe(true);
    expect(result.audits.every((a) => a.store_id === TENANTS[0].store.id)).toBe(true);
    expect(result.crossReadCount).toBe(0);
    expect(result.crossUpdateCount).toBe(0);

    // Attempting to INSERT a product into Store B while authenticated as Seller A MUST fail RLS WITH CHECK
    await expect(
      withTenantContext(pools.appPool, sellerACtx, (client) =>
        client.query(
          `INSERT INTO products (tenant_id, store_id, category_id, name, slug, status)
           VALUES ($1, $2, $3, 'Cross Tenant Injection', 'cross-tenant-injection', 'published')`,
          [TENANTS[1].id, TENANTS[1].store.id, CATEGORIES[0].id]
        )
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('prevents Customer A from seeing Customer B orders (DB-level IDOR/BOLA defense)', async () => {
    const customerACtx = {
      userId: USERS[6].id, // Ayesha
      role: 'customer',
    };

    const rows = await withTenantContext(pools.appPool, customerACtx, async (client) => {
      const res = await client.query('SELECT id, user_id FROM orders');
      return res.rows;
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.user_id === USERS[6].id)).toBe(true);
    expect(rows.some((r) => r.id === '80000000-0000-4000-8000-000000000002')).toBe(false);
  });

  it('hides draft products and suspended store products from anonymous storefront browsing', async () => {
    const draftProductId = STARTER_PRODUCTS[2].id; // Unpublished Draft Sketchbook

    const publicProducts = await withTenantContext(
      pools.appPool,
      { role: 'anonymous' },
      async (client) => {
        const res = await client.query('SELECT id, status FROM products');
        return res.rows;
      }
    );

    expect(publicProducts.length).toBeGreaterThan(0);
    expect(publicProducts.every((p) => p.status === 'published')).toBe(true);
    expect(publicProducts.some((p) => p.id === draftProductId)).toBe(false);
  });

  it('enforces append-only audit_log and least-privilege readonly role', async () => {
    const sellerACtx = {
      tenantId: TENANTS[0].id,
      storeId: TENANTS[0].store.id,
      userId: USERS[1].id,
      role: 'seller',
    };

    // cutecart_app CAN insert into audit_log
    await expect(
      withTenantContext(pools.appPool, sellerACtx, (client) =>
        client.query(
          `INSERT INTO audit_log (tenant_id, store_id, actor_id, action, resource_type)
           VALUES ($1, $2, $3, 'test.rls_check', 'store')`,
          [TENANTS[0].id, TENANTS[0].store.id, USERS[1].id]
        )
      )
    ).resolves.toBeDefined();

    // cutecart_app CANNOT update or delete audit_log (REVOKE UPDATE, DELETE)
    await expect(
      withTenantContext(pools.appPool, sellerACtx, (client) =>
        client.query(`DELETE FROM audit_log WHERE tenant_id = $1`, [TENANTS[0].id])
      )
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      withTenantContext(pools.appPool, sellerACtx, (client) =>
        client.query(`UPDATE audit_log SET action = 'tampered' WHERE tenant_id = $1`, [TENANTS[0].id])
      )
    ).rejects.toMatchObject({ code: '42501' });

    // cutecart_readonly CAN select, CANNOT insert
    const readCount = await withTenantContext(pools.readonlyPool, sellerACtx, async (client) => {
      const res = await client.query('SELECT COUNT(*)::int AS c FROM orders');
      return res.rows[0].c;
    });
    expect(readCount).toBeGreaterThan(0);

    await expect(
      withTenantContext(pools.readonlyPool, sellerACtx, (client) =>
        client.query(
          `INSERT INTO audit_log (tenant_id, store_id, actor_id, action, resource_type)
           VALUES ($1, $2, $3, 'readonly.illegal_write', 'store')`,
          [TENANTS[0].id, TENANTS[0].store.id, USERS[1].id]
        )
      )
    ).rejects.toMatchObject({ code: '42501' });
  });
});
