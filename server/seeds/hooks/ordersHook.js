import { TENANTS, USERS, STARTER_PRODUCTS } from '../seedData.js';

/**
 * M5 Orders & Commerce Seed Hook (T2.4 -> M5).
 *
 * Seeds idempotent sample coupons, addresses, orders, order_items, order_status_history,
 * payments, shipments, reviews, and audit_log entries across two stores so M5/M6 reports,
 * reviews, and EXPLAIN queries have realistic data immediately.
 *
 * M5 can override this by passing a custom `orderSeeder` function to `runSeed(pool, { orderSeeder })`.
 */
export async function defaultOrderSeeder(client) {
  const storeA = TENANTS[0];
  const storeB = TENANTS[1];
  const customerA = USERS[6]; // Ayesha
  const customerB = USERS[7]; // Hamza
  const sellerA = USERS[1];

  // 1. Sample Addresses (idempotent)
  await client.query(
    `INSERT INTO addresses (id, user_id, label, recipient_name, phone, line1, city, province, postal_code, country, is_default)
     VALUES
       ('70000000-0000-4000-8000-000000000001', $1, 'Home', 'Ayesha Noor', '+92-300-1112233', 'House 14-B, Gulberg III', 'Lahore', 'Punjab', '54660', 'PK', TRUE),
       ('70000000-0000-4000-8000-000000000002', $2, 'Hostel', 'Hamza Raza', '+92-321-4445566', 'Block 4, Clifton', 'Karachi', 'Sindh', '75600', 'PK', TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [customerA.id, customerB.id]
  );

  // 2. Sample Store Coupons (idempotent)
  const couponAId = '71000000-0000-4000-8000-000000000001';
  const couponBId = '71000000-0000-4000-8000-000000000002';

  await client.query(
    `INSERT INTO coupons (id, tenant_id, store_id, code, discount_type, discount_value, min_spend_pkr, max_uses, used_count, is_active)
     VALUES
       ($1, $2, $3, 'SAKURA10', 'percent', 10.00, 1000.00, 100, 1, TRUE),
       ($4, $5, $6, 'KAWAII200', 'fixed', 200.00, 800.00, 50, 0, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [couponAId, storeA.id, storeA.store.id, couponBId, storeB.id, storeB.store.id]
  );

  // 3. Sample Delivered Order in Store A (for Customer A)
  const orderAId = '80000000-0000-4000-8000-000000000001';
  const prodA = STARTER_PRODUCTS[0];
  const varA = prodA.variants[0];

  const { rowCount: insertedOrderA } = await client.query(
    `INSERT INTO orders (
       id, tenant_id, store_id, user_id, coupon_id, order_number, idempotency_key, status,
       subtotal_pkr, discount_pkr, shipping_pkr, tax_pkr, total_pkr, currency, shipping_address
     )
     VALUES (
       $1, $2, $3, $4, $5, 'CC-2026-00001', 'seed-idem-order-1', 'delivered',
       2900.00, 290.00, 200.00, 0.00, 2810.00, 'PKR',
       '{"recipient_name":"Ayesha Noor","line1":"House 14-B, Gulberg III","city":"Lahore","country":"PK"}'::jsonb
     )
     ON CONFLICT (id) DO NOTHING`,
    [orderAId, storeA.id, storeA.store.id, customerA.id, couponAId]
  );

  if (insertedOrderA > 0) {
    await client.query(
      `INSERT INTO order_items (
         id, tenant_id, store_id, order_id, product_id, variant_id,
         product_name, variant_sku, unit_price_pkr, quantity, line_total_pkr, currency
       )
       VALUES (
         '81000000-0000-4000-8000-000000000001', $1, $2, $3, $4, $5,
         $6, $7, 1450.00, 2, 2900.00, 'PKR'
       )
       ON CONFLICT (id) DO NOTHING`,
      [storeA.id, storeA.store.id, orderAId, prodA.id, varA.id, prodA.name, varA.sku]
    );

    await client.query(
      `INSERT INTO order_status_history (tenant_id, store_id, order_id, from_status, to_status, changed_by, reason)
       VALUES
         ($1, $2, $3, NULL, 'pending_payment', $4, 'Order placed'),
         ($1, $2, $3, 'pending_payment', 'confirmed', NULL, 'Payment webhook verified'),
         ($1, $2, $3, 'confirmed', 'delivered', $5, 'Delivered by carrier')`,
      [storeA.id, storeA.store.id, orderAId, customerA.id, sellerA.id]
    );

    await client.query(
      `INSERT INTO payments (
         id, tenant_id, store_id, order_id, provider, method, status,
         amount_pkr, currency, provider_payment_id, webhook_event_id, verified_at
       )
       VALUES (
         '82000000-0000-4000-8000-000000000001', $1, $2, $3,
         'stripe_sandbox', 'gateway', 'completed',
         2810.00, 'PKR', 'pi_seed_00001', 'evt_seed_00001', NOW()
       )
       ON CONFLICT (id) DO NOTHING`,
      [storeA.id, storeA.store.id, orderAId]
    );

    await client.query(
      `INSERT INTO shipments (
         id, tenant_id, store_id, order_id, carrier, tracking_number, status, shipped_at, delivered_at
       )
       VALUES (
         '83000000-0000-4000-8000-000000000001', $1, $2, $3,
         'tcs_mock', 'TCS-PK-000001', 'delivered', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'
       )
       ON CONFLICT (id) DO NOTHING`,
      [storeA.id, storeA.store.id, orderAId]
    );

    await client.query(
      `INSERT INTO reviews (
         id, tenant_id, store_id, product_id, user_id, order_id, rating, title, body, is_verified_purchase
       )
       VALUES (
         '84000000-0000-4000-8000-000000000001', $1, $2, $3, $4, $5,
         5, 'Gorgeous paper quality!', 'Zero ghosting with fountain pens and pastel highlighters.', TRUE
       )
       ON CONFLICT (id) DO NOTHING`,
      [storeA.id, storeA.store.id, prodA.id, customerA.id, orderAId]
    );
  }

  // 4. Sample Confirmed COD Order in Store B (for Customer B — proves cross-tenant separation)
  const orderBId = '80000000-0000-4000-8000-000000000002';
  const prodB = STARTER_PRODUCTS[3];
  const varB = prodB.variants[0];

  const { rowCount: insertedOrderB } = await client.query(
    `INSERT INTO orders (
       id, tenant_id, store_id, user_id, order_number, idempotency_key, status,
       subtotal_pkr, discount_pkr, shipping_pkr, tax_pkr, total_pkr, currency, shipping_address
     )
     VALUES (
       $1, $2, $3, $4, 'CC-2026-00002', 'seed-idem-order-2', 'confirmed',
       850.00, 0.00, 150.00, 0.00, 1000.00, 'PKR',
       '{"recipient_name":"Hamza Raza","line1":"Block 4, Clifton","city":"Karachi","country":"PK"}'::jsonb
     )
     ON CONFLICT (id) DO NOTHING`,
    [orderBId, storeB.id, storeB.store.id, customerB.id]
  );

  if (insertedOrderB > 0) {
    await client.query(
      `INSERT INTO order_items (
         id, tenant_id, store_id, order_id, product_id, variant_id,
         product_name, variant_sku, unit_price_pkr, quantity, line_total_pkr, currency
       )
       VALUES (
         '81000000-0000-4000-8000-000000000002', $1, $2, $3, $4, $5,
         $6, $7, 850.00, 1, 850.00, 'PKR'
       )
       ON CONFLICT (id) DO NOTHING`,
      [storeB.id, storeB.store.id, orderBId, prodB.id, varB.id, prodB.name, varB.sku]
    );

    await client.query(
      `INSERT INTO payments (
         id, tenant_id, store_id, order_id, provider, method, status, amount_pkr, currency
       )
       VALUES (
         '82000000-0000-4000-8000-000000000002', $1, $2, $3,
         'cod', 'cod', 'pending', 1000.00, 'PKR'
       )
       ON CONFLICT (id) DO NOTHING`,
      [storeB.id, storeB.store.id, orderBId]
    );
  }

  // 5. Initial Audit Log entries (one per store, idempotent via deterministic IDs)
  await client.query(
    `INSERT INTO audit_log (id, tenant_id, store_id, actor_id, action, resource_type, resource_id, metadata)
     VALUES
       ('85000000-0000-4000-8000-000000000001', $1, $2, $3, 'store.seeded', 'store', $2, '{"source":"seed"}'::jsonb),
       ('85000000-0000-4000-8000-000000000002', $4, $5, $6, 'store.seeded', 'store', $5, '{"source":"seed"}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [storeA.id, storeA.store.id, sellerA.id, storeB.id, storeB.store.id, USERS[3].id]
  );

  return { seededOrders: 2 };
}
