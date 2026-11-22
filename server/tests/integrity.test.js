import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestPools, ensureMigratedAndSeeded, closeTestPools } from './helpers/testDb.js';
import { TENANTS, USERS, STARTER_PRODUCTS } from '../seeds/seedData.js';

describe('T2.3 & T2.6 — Referential Integrity, Domain Checks, Uniqueness & Composite FKs', () => {
  let pools;

  beforeAll(async () => {
    pools = createTestPools();
    await ensureMigratedAndSeeded(pools.migratorPool);
  });

  afterAll(async () => {
    await closeTestPools(pools);
  });

  it('rejects negative or zero variant prices (CHECK price_pkr > 0)', async () => {
    await expect(
      pools.migratorPool.query(
        `INSERT INTO variants (tenant_id, store_id, product_id, sku, price_pkr, currency)
         VALUES ($1, $2, $3, 'BAD-PRICE-SKU', -50.00, 'PKR')`,
        [TENANTS[0].id, TENANTS[0].store.id, STARTER_PRODUCTS[0].id]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects non-PKR currency (CHECK currency = PKR)', async () => {
    await expect(
      pools.migratorPool.query(
        `INSERT INTO variants (tenant_id, store_id, product_id, sku, price_pkr, currency)
         VALUES ($1, $2, $3, 'USD-SKU-BAD', 1200.00, 'USD')`,
        [TENANTS[0].id, TENANTS[0].store.id, STARTER_PRODUCTS[0].id]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects invalid order/payment/shipment status enum values', async () => {
    await expect(
      pools.migratorPool.query(
        `INSERT INTO orders (
           tenant_id, store_id, user_id, order_number, idempotency_key, status,
           subtotal_pkr, total_pkr, shipping_address
         )
         VALUES ($1, $2, $3, 'CC-BAD-STATUS', 'idem-bad-status', 'paid_magic', 100.00, 100.00, '{}'::jsonb)`,
        [TENANTS[0].id, TENANTS[0].store.id, USERS[6].id]
      )
    ).rejects.toMatchObject({ code: '22P02' });
  });

  it('rejects mismatched order total arithmetic (CHECK total = subtotal - discount + shipping + tax)', async () => {
    await expect(
      pools.migratorPool.query(
        `INSERT INTO orders (
           tenant_id, store_id, user_id, order_number, idempotency_key, status,
           subtotal_pkr, discount_pkr, shipping_pkr, tax_pkr, total_pkr, shipping_address
         )
         VALUES ($1, $2, $3, 'CC-BAD-MATH', 'idem-bad-math', 'pending_payment', 1000.00, 100.00, 150.00, 0.00, 5.00, '{}'::jsonb)`,
        [TENANTS[0].id, TENANTS[0].store.id, USERS[6].id]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects reserved_quantity > stock_quantity on inventory', async () => {
    const varId = STARTER_PRODUCTS[0].variants[0].id;
    await expect(
      pools.migratorPool.query(
        `UPDATE inventory SET reserved_quantity = stock_quantity + 5 WHERE variant_id = $1`,
        [varId]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects percentage coupon > 100% and review ratings outside 1..5', async () => {
    await expect(
      pools.migratorPool.query(
        `INSERT INTO coupons (tenant_id, store_id, code, discount_type, discount_value)
         VALUES ($1, $2, 'FREE150', 'percent', 150.00)`,
        [TENANTS[0].id, TENANTS[0].store.id]
      )
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      pools.migratorPool.query(
        `INSERT INTO reviews (tenant_id, store_id, product_id, user_id, order_id, rating, body)
         VALUES ($1, $2, $3, $4, '80000000-0000-4000-8000-000000000001', 6, 'Impossible rating')`,
        [TENANTS[0].id, TENANTS[0].store.id, STARTER_PRODUCTS[0].id, USERS[7].id]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('enforces uniqueness on case-insensitive user email, store SKU, and payment webhook_event_id', async () => {
    // Duplicate email (different casing)
    await expect(
      pools.migratorPool.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ('ADMIN@CUTECART.PK', 'hash', 'Duplicate Admin')`
      )
    ).rejects.toMatchObject({ code: '23505' });

    // Duplicate SKU in the SAME store
    await expect(
      pools.migratorPool.query(
        `INSERT INTO variants (tenant_id, store_id, product_id, sku, price_pkr)
         VALUES ($1, $2, $3, $4, 1500.00)`,
        [
          TENANTS[0].id,
          TENANTS[0].store.id,
          STARTER_PRODUCTS[0].id,
          STARTER_PRODUCTS[0].variants[0].sku,
        ]
      )
    ).rejects.toMatchObject({ code: '23505' });

    // Duplicate webhook_event_id (webhook idempotency)
    await expect(
      pools.migratorPool.query(
        `INSERT INTO payments (
           tenant_id, store_id, order_id, provider, method, status, amount_pkr, webhook_event_id
         )
         VALUES ($1, $2, '80000000-0000-4000-8000-000000000001', 'stripe_sandbox', 'gateway', 'completed', 2810.00, 'evt_seed_00001')`,
        [TENANTS[0].id, TENANTS[0].store.id]
      )
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('BLOCKS cross-store order_item referencing a product/variant from another store (Composite FK)', async () => {
    const storeAOrderId = '80000000-0000-4000-8000-000000000001';
    const storeBProduct = STARTER_PRODUCTS[3]; // belongs to TENANTS[1] / Store B
    const storeBVariant = storeBProduct.variants[0];

    // Attempt to attach Store B's product & variant onto Store A's order -> MUST FAIL with 23503
    await expect(
      pools.migratorPool.query(
        `INSERT INTO order_items (
           tenant_id, store_id, order_id, product_id, variant_id,
           product_name, variant_sku, unit_price_pkr, quantity, line_total_pkr
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 850.00, 1, 850.00)`,
        [
          TENANTS[0].id,
          TENANTS[0].store.id,
          storeAOrderId,
          storeBProduct.id,
          storeBVariant.id,
          storeBProduct.name,
          storeBVariant.sku,
        ]
      )
    ).rejects.toMatchObject({ code: '23503' });
  });
});
