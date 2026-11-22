# Module Specification: Database & Multi-Tenant Isolation (`server/src/db`)

**Owner:** M2  
**Tasks Covered:** T2.1, T2.2, T2.3, T2.4, T2.5, T2.6, T2.7, T2.8

---

## 1. Purpose & Boundaries

This module owns CuteCart's relational schema, migrations, tenant-isolation enforcement, connection pooling, seed framework, and data lifecycle policies. **Only M2 modifies database migrations.** Other modules (M3 Auth/Admin, M4 Catalogue/Inventory, M5 Cart/Orders, M6 Payments/Fulfillment/Notifications) consume `getAppPool()` and `withTenantContext()`.

---

## 2. Architecture & Security Design

### 2.1 Dual-Pool Separation of Privilege
- **`cutecart_migrator` (`DATABASE_URL`):** Used strictly during deployment migrations (`npm run db:migrate`) and seeding (`npm run seed`).
- **`cutecart_app` (`APP_DATABASE_URL`):** Runtime role configured with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`. Cannot alter schema (`CREATE` revoked on `public`), cannot update or delete `audit_log` rows, and is strictly bound by `FORCE ROW LEVEL SECURITY`.
- **`cutecart_readonly` (`READONLY_DATABASE_URL`):** `SELECT`-only reporting role subject to RLS.

### 2.2 Defense-in-Depth Tenant Isolation
1. **Composite Foreign Keys (Migration `003`):** Every store-owned child table (`variants`, `inventory`, `cart_items`, `order_items`, `order_status_history`, `payments`, `shipments`, `refunds`, `reviews`, `wishlist`) references parent tables via `(tenant_id, store_id, id)`. Attempting to attach Store B's product to Store A's order raises PostgreSQL SQLSTATE `23503`.
2. **Row-Level Security (Migration `003`):** All 20 tenant/user-scoped tables enforce RLS policies reading transaction-local session parameters via `withTenantContext()`:
   - `app.current_tenant_id`, `app.current_store_id`, `app.current_user_id`, `app.current_guest_token`, `app.current_role`.
   - Because `set_config(..., true)` scopes settings to the current transaction (`SET LOCAL`), connection reuse in `pg.Pool` can never bleed one tenant's context into another request.
   - Public storefront browsing (`role = 'anonymous'` or `'customer'`) can only read `status = 'published'` products belonging to `status = 'active'` stores.

### 2.3 Data Integrity Rules
- **Money:** `NUMERIC(12, 2)` + `CHECK (currency = 'PKR')`; `pg` type parser `1700` keeps values as exact decimal strings (never JS IEEE-754 floats).
- **Order Math:** `CHECK (total_pkr = subtotal_pkr - discount_pkr + shipping_pkr + tax_pkr)` and `CHECK (line_total_pkr = unit_price_pkr * quantity)`.
- **Idempotency:** Unique constraints on `orders (store_id, user_id, idempotency_key)` and `payments (webhook_event_id)`.
- **Concurrency:** Atomic `UPDATE inventory SET stock_quantity = stock_quantity - $1 WHERE ... AND (stock_quantity - reserved_quantity) >= $1` prevents negative stock under parallel checkouts.

---

## 3. Connection Pool & Performance Tuning (T2.5)

Configured via environment variables in `server/src/db/pool.js`:
- `DB_POOL_MAX=20`, `DB_POOL_MIN=2`
- `DB_POOL_IDLE_TIMEOUT_MS=30000`, `DB_POOL_CONNECTION_TIMEOUT_MS=5000`
- `DB_STATEMENT_TIMEOUT_MS=10000` (guards against runaway queries)
- Session `timezone=UTC` enforced on every connection.

All 20+ indexes in Migration `004` are verified by `npm run db:explain` and documented in `docs/database/EXPLAIN_PROOF.md`.

---

## 4. Verification Plan (T2.6)
Automated Vitest suite verifies:
1. Full `migrateUp` -> `migrateDown --all` -> `migrateUp` reversibility.
2. Referential integrity, domain `CHECK` rules, `UNIQUE` constraints, and cross-store composite FK rejection.
3. End-to-end tenant isolation through `cutecart_app` (real RLS path, including append-only `audit_log`).
4. Parallel checkout race for the last 1 unit of inventory across two concurrent connections.
5. Seed idempotency (`npm run seed` twice with zero duplicates).
