import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { getMigratorPool, withTransaction, closeAllPools } from '../src/db/pool.js';
import { TENANTS, USERS, CATEGORIES } from './seedData.js';
import { defaultProductSeeder } from './hooks/productsHook.js';
import { defaultOrderSeeder } from './hooks/ordersHook.js';

const DEFAULT_DEV_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'CuteCart#2026!';
const BCRYPT_COST = process.env.NODE_ENV === 'test' ? 4 : 12;

/**
 * Idempotent seed framework (T2.4).
 * Safe to run multiple times without creating duplicate rows or throwing conflict errors.
 *
 * Exposes pluggable hooks:
 * - `productSeeder` (for M4 T4.6 — or place server/seeds/data/products.json)
 * - `orderSeeder` (for M5)
 */
export async function runSeed(
  pool,
  {
    productSeeder = defaultProductSeeder,
    orderSeeder = defaultOrderSeeder,
    logger = console,
  } = {}
) {
  const passwordHash = await bcrypt.hash(DEFAULT_DEV_PASSWORD, BCRYPT_COST);

  return withTransaction(pool, async (client) => {
    // 1. Seed 4 Tenants & 4 Active Stores
    for (const t of TENANTS) {
      await client.query(
        `INSERT INTO tenants (id, name, slug, status, contact_email)
         VALUES ($1, $2, $3, $4::tenant_status, $5)
         ON CONFLICT (slug) DO NOTHING`,
        [t.id, t.name, t.slug, t.status, t.contactEmail]
      );

      await client.query(
        `INSERT INTO stores (id, tenant_id, name, slug, description, status, currency, city)
         VALUES ($1, $2, $3, $4, $5, 'active', 'PKR', $6)
         ON CONFLICT (slug) DO NOTHING`,
        [t.store.id, t.id, t.store.name, t.store.slug, t.store.description, t.store.city]
      );
    }

    // 2. Seed Users (every role: platform_admin, seller, staff, customer) & Memberships
    for (const u of USERS) {
      await client.query(
        `INSERT INTO users (id, email, username, password_hash, full_name, email_verified, is_platform_admin)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.email, u.username, passwordHash, u.fullName, u.isPlatformAdmin]
      );

      if (u.storeId) {
        await client.query(
          `INSERT INTO memberships (tenant_id, store_id, user_id, role, is_active)
           VALUES ($1, $2, $3, $4::user_role, TRUE)
           ON CONFLICT (tenant_id, store_id, user_id, role) WHERE store_id IS NOT NULL DO NOTHING`,
          [u.tenantId, u.storeId, u.id, u.role]
        );
      } else {
        await client.query(
          `INSERT INTO memberships (tenant_id, store_id, user_id, role, is_active)
           VALUES ($1, NULL, $2, $3::user_role, TRUE)
           ON CONFLICT (tenant_id, user_id, role) WHERE store_id IS NULL DO NOTHING`,
          [u.tenantId, u.id, u.role]
        );
      }
    }

    // 3. Seed 10 Stationery Categories
    const categoryBySlug = new Map();
    for (const c of CATEGORIES) {
      const { rows } = await client.query(
        `INSERT INTO categories (id, name, slug, icon, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, slug`,
        [c.id, c.name, c.slug, c.icon, c.sortOrder]
      );
      categoryBySlug.set(rows[0].slug, rows[0].id);
    }

    // 4. M4 Hook: Products, Variants & Inventory
    const productStats = productSeeder
      ? await productSeeder(client, { tenants: TENANTS, categoryBySlug, logger })
      : { productCount: 0, variantCount: 0 };

    // 5. M5 Hook: Sample Orders, Coupons, Payments, Shipments, Reviews
    const orderStats = orderSeeder
      ? await orderSeeder(client, { tenants: TENANTS, users: USERS, logger })
      : { seededOrders: 0 };

    return {
      tenants: TENANTS.length,
      stores: TENANTS.length,
      users: USERS.length,
      categories: CATEGORIES.length,
      ...productStats,
      ...orderStats,
    };
  });
}

// Execute when invoked directly via `npm run seed`
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const pool = getMigratorPool();
  runSeed(pool)
    .then((summary) => {
      console.log('[seed] Completed successfully:', summary);
    })
    .catch((err) => {
      console.error('[seed:error]', err);
      process.exitCode = 1;
    })
    .finally(() => closeAllPools());
}
