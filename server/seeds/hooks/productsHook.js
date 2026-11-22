import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TENANTS, STARTER_PRODUCTS } from '../seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const M4_PRODUCTS_JSON = path.resolve(__dirname, '../data/products.json');

/**
 * M4 Product Seed Hook (T2.4 -> T4.6).
 *
 * When M4 provides `server/seeds/data/products.json` (80-100 PKR stationery products),
 * this hook automatically ingests it idempotently. Until then, it seeds the built-in
 * starter stationery catalog across all 4 stores so Search (T4.5) and EXPLAIN (T2.5)
 * work out of the box from a clean clone.
 */
export async function defaultProductSeeder(client, { categoryBySlug, logger = console }) {
  let productsToSeed = STARTER_PRODUCTS;

  try {
    const raw = await fs.readFile(M4_PRODUCTS_JSON, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      productsToSeed = parsed;
      logger?.info?.(`[seed:products] Loaded ${parsed.length} products from M4 data/products.json`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`Failed to parse M4 products.json: ${err.message}`, { cause: err });
    }
  }

  let productCount = 0;
  let variantCount = 0;

  for (const item of productsToSeed) {
    const tenant = TENANTS[item.tenantIndex ?? 0] || TENANTS[0];
    const storeId = item.storeId || tenant.store.id;
    const tenantId = item.tenantId || tenant.id;
    const categoryId = item.categoryId || categoryBySlug.get(item.categorySlug);

    if (!categoryId) {
      throw new Error(`Unknown categorySlug "${item.categorySlug}" for product "${item.name}"`);
    }

    const { rows: prodRows } = await client.query(
      `INSERT INTO products (
         id, tenant_id, store_id, category_id, name, slug, description,
         status, image_url, is_bestseller, published_at
       )
       VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
         $8::product_status, $9, $10,
         CASE WHEN $8 = 'published' THEN NOW() ELSE NULL END
       )
       ON CONFLICT (store_id, slug) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             status = EXCLUDED.status,
             updated_at = NOW()
       RETURNING id`,
      [
        item.id || null,
        tenantId,
        storeId,
        categoryId,
        item.name,
        item.slug,
        item.description || '',
        item.status || 'published',
        item.imageUrl || null,
        Boolean(item.isBestseller),
      ]
    );

    const productId = prodRows[0].id;
    productCount += 1;

    for (const v of item.variants || []) {
      const { rows: varRows } = await client.query(
        `INSERT INTO variants (
           id, tenant_id, store_id, product_id, sku, title, price_pkr, color, size, currency
         )
         VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7::numeric, $8, $9, 'PKR'
         )
         ON CONFLICT (store_id, sku) DO UPDATE
           SET title = EXCLUDED.title,
               price_pkr = EXCLUDED.price_pkr,
               updated_at = NOW()
         RETURNING id`,
        [
          v.id || null,
          tenantId,
          storeId,
          productId,
          v.sku,
          v.title || 'Default',
          String(v.pricePkr),
          v.color || null,
          v.size || null,
        ]
      );

      const variantId = varRows[0].id;
      variantCount += 1;

      await client.query(
        `INSERT INTO inventory (tenant_id, store_id, variant_id, stock_quantity, reserved_quantity, low_stock_threshold)
         VALUES ($1, $2, $3, $4, 0, $5)
         ON CONFLICT (variant_id) DO NOTHING`,
        [tenantId, storeId, variantId, v.stock ?? 25, v.lowStockThreshold ?? 5]
      );
    }
  }

  return { productCount, variantCount };
}
