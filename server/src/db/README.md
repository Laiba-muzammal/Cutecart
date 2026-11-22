# Database Module (`server/src/db`)

**Owner:** M2 (Database, Search, Background Jobs)

PostgreSQL connection pool, deterministic up/down SQL migration runner, transaction-local Row-Level Security (RLS) tenant context helper, and atomic inventory helpers.

## Quick Commands

```bash
# 1. Start PostgreSQL locally (from repo root)
docker compose -f docker-compose.db.yml up -d

# 2. Configure env
cp server/.env.example server/.env

# 3. Run migrations, check status, and seed
cd server
npm install
npm run db:migrate
npm run db:migrate:status
npm run seed

# 4. Run database tests & EXPLAIN ANALYZE proof
npm test
npm run db:explain
```

## Key Exports
- `getMigratorPool()` / `getAppPool()` — Pooled connections with `NUMERIC` decimal-string preservation and `statement_timeout`.
- `withTenantContext(pool, { tenantId, storeId, userId, role }, fn)` — Executes queries inside a transaction with `SET LOCAL app.*` so pooled connections never leak tenant state.
- `migrateUp(pool)` / `migrateDown(pool, { steps, all })` — Advisory-locked reversible SQL migrations.
- `decrementStockAtomically()` / `reserveStockAtomically()` / `releaseExpiredReservations()` — Concurrency-safe inventory primitives.

## Related Docs
- [Module Spec](./SPEC.md)
- [Requirements, ER Diagram & Data Dictionary](../../../docs/database/REQUIREMENTS_AND_ERD.md)
- [Multi-Store Extension Plan](../../../docs/database/EXTENSION_PLAN.md)
- [Retention & MongoDB Sunset Policy](../../../docs/database/RETENTION_POLICY.md)
- [EXPLAIN ANALYZE Proof](../../../docs/database/EXPLAIN_PROOF.md)
