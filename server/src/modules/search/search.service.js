import { withTenantContext } from '../../db/pool.js';
import { isUuid } from './search.schema.js';

/**
 * Full-text search on published products of active stores (T4.5).
 *
 * - Searches weighted PostgreSQL tsvector across product name (A), category (B), and description (C)
 * - Filters by category (UUID or slug), store (UUID or slug), PKR price range, and inStock
 * - Sorts by relevance, price_asc, price_desc, name_asc, name_desc, or newest
 * - Runs under `withTenantContext(..., { role: 'anonymous' })` so RLS is enforced on every read
 * - Returns money strictly as decimal strings (`"1450.00"`) with currency `"PKR"`
 */
export async function searchProducts(pool, params) {
  const {
    q,
    category,
    store,
    minPrice,
    maxPrice,
    inStock,
    sort,
    page = 1,
    pageSize = 20,
  } = params;

  const effectiveSort = sort || (q ? 'relevance' : 'newest');
  const offset = (page - 1) * pageSize;

  const values = [];
  const addParam = (val) => {
    values.push(val);
    return `$${values.length}`;
  };

  const whereClauses = [
    `p.status = 'published'`,
    `p.deleted_at IS NULL`,
    `s.status = 'active'`,
    `s.deleted_at IS NULL`,
    `c.is_active = TRUE`,
  ];

  let rankExpr = `0::real`;
  if (q) {
    const qParam = addParam(q);
    whereClauses.push(`p.search_vector @@ websearch_to_tsquery('english', ${qParam})`);
    rankExpr = `ts_rank_cd(p.search_vector, websearch_to_tsquery('english', ${qParam}))`;
  }

  if (category) {
    const catParam = addParam(category);
    if (isUuid(category)) {
      whereClauses.push(`c.id = ${catParam}::uuid`);
    } else {
      whereClauses.push(`LOWER(c.slug) = LOWER(${catParam})`);
    }
  }

  if (store) {
    const storeParam = addParam(store);
    if (isUuid(store)) {
      whereClauses.push(`s.id = ${storeParam}::uuid`);
    } else {
      whereClauses.push(`LOWER(s.slug) = LOWER(${storeParam})`);
    }
  }

  // Filter variants inside the product price aggregation CTE
  const variantFilterClauses = [`v.is_active = TRUE`, `v.deleted_at IS NULL`];
  if (minPrice !== undefined) {
    const minParam = addParam(minPrice.toFixed(2));
    variantFilterClauses.push(`v.price_pkr >= ${minParam}::numeric`);
  }
  if (maxPrice !== undefined) {
    const maxParam = addParam(maxPrice.toFixed(2));
    variantFilterClauses.push(`v.price_pkr <= ${maxParam}::numeric`);
  }
  if (inStock === true) {
    variantFilterClauses.push(`(i.stock_quantity - i.reserved_quantity) > 0`);
  }

  // Strict allow-list ORDER BY (never interpolates raw user input)
  const orderByMap = {
    relevance: `rank DESC, is_bestseller DESC, created_at DESC`,
    price_asc: `min_price_pkr ASC, name ASC`,
    price_desc: `min_price_pkr DESC, name ASC`,
    name_asc: `LOWER(name) ASC, id ASC`,
    name_desc: `LOWER(name) DESC, id ASC`,
    newest: `created_at DESC, id ASC`,
  };
  const orderBySql = orderByMap[effectiveSort] || orderByMap.newest;

  const limitParam = addParam(pageSize);
  const offsetParam = addParam(offset);

  const sql = `
    WITH matched_variants AS (
      SELECT
        v.product_id,
        MIN(v.price_pkr) AS min_price_pkr,
        MAX(v.price_pkr) AS max_price_pkr,
        SUM(GREATEST(0, COALESCE(i.stock_quantity - i.reserved_quantity, 0)))::int AS available_stock,
        COUNT(v.id)::int AS variant_count
      FROM variants v
      LEFT JOIN inventory i ON i.variant_id = v.id
      WHERE ${variantFilterClauses.join(' AND ')}
      GROUP BY v.product_id
    ),
    ranked AS (
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.image_url,
        p.is_featured,
        p.is_bestseller,
        p.created_at,
        c.id AS category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        s.id AS store_id,
        s.name AS store_name,
        s.slug AS store_slug,
        s.city AS store_city,
        mv.min_price_pkr,
        mv.max_price_pkr,
        mv.available_stock,
        mv.variant_count,
        ${rankExpr} AS rank,
        COUNT(*) OVER()::int AS total_count
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      INNER JOIN stores s ON s.id = p.store_id AND s.tenant_id = p.tenant_id
      INNER JOIN matched_variants mv ON mv.product_id = p.id
      WHERE ${whereClauses.join(' AND ')}
    )
    SELECT *
    FROM ranked
    ORDER BY ${orderBySql}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const rows = await withTenantContext(pool, { role: 'anonymous' }, async (client) => {
    const res = await client.query(sql, values);
    return res.rows;
  });

  const total = rows.length > 0 ? rows[0].total_count : 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  const data = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    price: Number(row.min_price_pkr).toFixed(2),
    maxPrice: Number(row.max_price_pkr).toFixed(2),
    currency: 'PKR',
    inStock: row.available_stock > 0,
    availableStock: row.available_stock,
    variantCount: row.variant_count,
    isFeatured: row.is_featured,
    isBestseller: row.is_bestseller,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    store: {
      id: row.store_id,
      name: row.store_name,
      slug: row.store_slug,
      city: row.store_city,
    },
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      sort: effectiveSort,
      currency: 'PKR',
      filters: {
        q: q ?? null,
        category: category ?? null,
        store: store ?? null,
        minPrice: minPrice !== undefined ? minPrice.toFixed(2) : null,
        maxPrice: maxPrice !== undefined ? maxPrice.toFixed(2) : null,
        inStock: inStock ?? null,
      },
    },
  };
}
