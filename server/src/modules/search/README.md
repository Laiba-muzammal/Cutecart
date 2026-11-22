# Search Module (`server/src/modules/search`) — T4.5

**Owner:** M2 (Database, Search, Background Jobs)  
**Endpoint:** `GET /api/v1/products/search`

PostgreSQL full-text search across product name, category, and description with category/store/PKR price-range filtering, sorting, Zod validation, and Row-Level Security enforcement.

## Query Parameters (Aligned with M4 Catalogue API)
- `q` — Free-text query (`websearch_to_tsquery('english', q)`)
- `category` — Category slug (e.g., `notebooks`) or UUID
- `store` — Active store slug (e.g., `paperpetal`) or UUID
- `minPrice` / `maxPrice` — PKR price bounds
- `inStock` — `true` | `false`
- `sort` — `relevance` | `price_asc` | `price_desc` | `name_asc` | `name_desc` | `newest`
- `page` (default `1`) & `pageSize` (default `20`, max `100`)

## Files
- `search.schema.js` — Zod query validator
- `search.service.js` — Parameterised FTS SQL running under `withTenantContext(..., { role: 'anonymous' })`
- `search.routes.js` — Express router returning `{ data, meta }` / `{ error: { code, message } }`
- `openapi.yaml` — OpenAPI 3.1 contract
- [SPEC.md](./SPEC.md) — Module specification
