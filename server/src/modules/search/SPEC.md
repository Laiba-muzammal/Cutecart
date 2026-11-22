# Module Specification: Product Full-Text Search (`server/src/modules/search`)

**Owner:** M2  
**Task:** T4.5 (Search)

---

## 1. Scope & Guarantees

Provides fast, secure search over CuteCart's multi-tenant stationery catalogue without adding external search infrastructure (Elasticsearch/Meilisearch).

- **Visibility rule:** Strictly returns `products.status = 'published'` and `products.deleted_at IS NULL` belonging to `stores.status = 'active'` and `stores.deleted_at IS NULL`. Enforced both in SQL predicates AND via PostgreSQL RLS under the least-privilege `cutecart_app` role (`role = 'anonymous'`).
- **Relevance ranking:** Weighted `TSVECTOR` maintained automatically by PostgreSQL triggers (`004_search_fts_and_indexes.up.sql`):
  - Weight `A`: `products.name`
  - Weight `B`: `categories.name` (refreshed automatically if a category is renamed)
  - Weight `C`: `products.description`
- **Index backing:** Partial GIN index `idx_products_search_vector_gin` + variant price indexes `idx_variants_product_price_active` and `idx_variants_price_active`.

---

## 2. API Contract (`GET /api/v1/products/search`)

Full OpenAPI 3.1 definition lives in [openapi.yaml](./openapi.yaml).
- **Success (`200`):** `{ data: ProductSearchHit[], meta: { page, pageSize, total, totalPages, sort, currency: "PKR", filters } }`
- **Error (`400`/`500`):** `{ error: { code, message } }`
- **Money formatting:** Exact decimal strings (`"1450.00"`), currency `"PKR"`.
- **SQL Injection safety:** Every filter value is bound via `$1, $2, ...` placeholders; `ORDER BY` uses a strict allow-list map.

---

## 3. Coordination with M4
M4's storefront Shop page (`T4.7`) and Catalogue API (`T4.1`) share the exact same query parameter names (`q`, `category`, `store`, `minPrice`, `maxPrice`, `inStock`, `sort`, `page`, `pageSize`) and pagination envelope (`{ data, meta }`), allowing seamless integration.
