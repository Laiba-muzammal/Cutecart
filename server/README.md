# CuteCart Server — M2 Deliverables (Database, Search, Background Jobs)

**Owner:** M2  
**Backup Partner:** M1

This directory contains CuteCart's PostgreSQL schema migrations, Row-Level Security (RLS) tenant isolation, idempotent seed framework, `pg-boss` background job queue, full-text product search API, performance `EXPLAIN ANALYZE` proofs, legacy MongoDB user migration script, and automated integration tests.

## Clean-Clone Quick Start

```bash
# 1. Start PostgreSQL 16 + Mailpit from repo root
docker compose -f docker-compose.db.yml up -d

# 2. Configure environment
cp server/.env.example server/.env

# 3. Install, migrate, seed, and test
cd server
npm install
npm run db:migrate
npm run seed
npm test
npm run db:explain
```

## Task Map (All M2 Tasks)

| Task | Deliverable | Location |
|---|---|---|
| **T2.1** | DB Requirements, Mermaid ER Diagram & Data Dictionary | `docs/database/REQUIREMENTS_AND_ERD.md` |
| **T2.2** | Schema v1 Reversible SQL Migrations (22 core + 2 support tables) | `server/migrations/001..002`, `server/src/db/migrator.js` |
| **T2.3** | Composite FKs, CHECK/UNIQUE rules, FORCE RLS & Least-Privilege Roles | `server/migrations/003_integrity_composite_fks_and_rls.*` |
| **T2.4** | Idempotent Seed Framework (4 tenants, all roles, M4/M5 hooks) | `server/seeds/seed.js`, `server/seeds/hooks/` |
| **T6.8** | `pg-boss` Background Job Queue (retries, DLQ, cron, example jobs) | `server/src/modules/jobs/` |
| **T4.5** | Full-Text Search API (`/api/v1/products/search`) + OpenAPI 3.1 | `server/src/modules/search/` |
| **T2.5** | Query-Justified Indexes, Pool Tuning & `EXPLAIN ANALYZE` Proof | `server/migrations/004_*`, `server/scripts/explain-queries.js`, `docs/database/EXPLAIN_PROOF.md` |
| **T2.6** | Database, Tenant Isolation, Concurrency & Migration Tests | `server/tests/` |
| **T2.7** | Legacy MongoDB User Migration & Retention / Soft-Delete Policy | `server/scripts/migrate-mongo-users.js`, `docs/database/RETENTION_POLICY.md` |
| **T2.8** | Multi-Store Checkout Extension Plan (1-page architecture doc) | `docs/database/EXTENSION_PLAN.md` |
