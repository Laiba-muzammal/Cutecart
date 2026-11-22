# CuteCart Index Justification & `EXPLAIN ANALYZE` Proof (T2.5)

**Generated:** 2026-11-22T09:41:37.423Z  
**Owner:** M2 (Database, Search, Background Jobs)  
**Connection Pool Config (`server/src/db/pool.js`):** `max=20`, `min=2`, `idleTimeoutMillis=30000`, `connectionTimeoutMillis=5000`, `statement_timeout=10000ms`, `timezone=UTC`.

---

## Summary Matrix

| Query | Purpose | Expected Index | Verified in Planner |
|---|---|---|---|
| **Q1** | Full-Text Product Search (GIN Index — T4.5) | `idx_products_search_vector_gin` | PASS |
| **Q2** | Storefront Catalogue Browse by Category & Store (Partial B-Tree — T4.1) | `idx_products_published_browse` | PASS |
| **Q3** | Variant Price Range Filter (Partial Price B-Tree — T4.5) | `idx_variants_price_active` | PASS |
| **Q4** | Customer Order History (Composite B-Tree — T5.4) | `idx_orders_user_created` | PASS |
| **Q5** | Seller Fulfillment Queue Scoped by Tenant & Store (Composite B-Tree — T6.4) | `idx_orders_tenant_store_status_created` | PASS |
| **Q6** | Atomic Inventory Lookup by Variant (Unique B-Tree — T4.4 / T5.3) | `inventory_variant_id_key` | PASS |
| **Q7** | Expiring Inventory Reservations Sweep (Partial B-Tree — T5.6 / T6.8) | `idx_inventory_reservations_active_expiry` | PASS |
| **Q8** | Payment Webhook Idempotency Lookup (Partial Unique B-Tree — T6.2) | `uq_payments_webhook_event_id` | PASS |
| **Q9** | Admin Audit Log Timeline by Tenant (Composite B-Tree — T3.6) | `idx_audit_log_tenant_created` | PASS |
| **Q10** | Verified Product Reviews Sorted Newest First (Partial B-Tree — T7.3) | `idx_reviews_product_created` | PASS |

> **Note on small dev datasets:** On tables with fewer than ~100 rows, PostgreSQL legitimately chooses a 1-page `Seq Scan` by default because touching both an index page and heap page costs more I/O than scanning 1 page. For each query below, we capture both the live default `EXPLAIN (ANALYZE, BUFFERS)` plan and the scale-equivalent index-selected plan (`SET LOCAL enable_seqscan = off`) proving the index matches the exact predicate and sort order.

---

## Q1: Full-Text Product Search (GIN Index — T4.5)
- **Target Index:** `idx_products_search_vector_gin`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=17.02..17.02 rows=1 width=52) (actual time=0.140..0.141 rows=1.00 loops=1)
  Buffers: shared hit=6
  ->  Sort  (cost=17.02..17.02 rows=1 width=52) (actual time=0.139..0.140 rows=1.00 loops=1)
        Sort Key: (ts_rank_cd(search_vector, '''sakura'' & ''notebook'''::tsquery)) DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=6
        ->  Bitmap Heap Scan on products p  (cost=12.99..17.01 rows=1 width=52) (actual time=0.133..0.134 rows=1.00 loops=1)
              Recheck Cond: ((search_vector @@ '''sakura'' & ''notebook'''::tsquery) AND (status = 'published'::product_status) AND (deleted_at IS NULL))
              Heap Blocks: exact=1
              Buffers: shared hit=6
              ->  Bitmap Index Scan on idx_products_search_vector_gin  (cost=0.00..12.99 rows=1 width=0) (actual time=0.053..0.053 rows=1.00 loops=1)
                    Index Cond: (search_vector @@ '''sakura'' & ''notebook'''::tsquery)
                    Index Searches: 1
                    Buffers: shared hit=5
Planning:
  Buffers: shared hit=95
Planning Time: 4.361 ms
Execution Time: 0.180 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=17.02..17.02 rows=1 width=52) (actual time=0.065..0.066 rows=1.00 loops=1)
  Buffers: shared hit=6
  ->  Sort  (cost=17.02..17.02 rows=1 width=52) (actual time=0.064..0.065 rows=1.00 loops=1)
        Sort Key: (ts_rank_cd(search_vector, '''sakura'' & ''notebook'''::tsquery)) DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=6
        ->  Bitmap Heap Scan on products p  (cost=12.99..17.01 rows=1 width=52) (actual time=0.057..0.058 rows=1.00 loops=1)
              Recheck Cond: ((search_vector @@ '''sakura'' & ''notebook'''::tsquery) AND (status = 'published'::product_status) AND (deleted_at IS NULL))
              Heap Blocks: exact=1
              Buffers: shared hit=6
              ->  Bitmap Index Scan on idx_products_search_vector_gin  (cost=0.00..12.99 rows=1 width=0) (actual time=0.014..0.014 rows=1.00 loops=1)
                    Index Cond: (search_vector @@ '''sakura'' & ''notebook'''::tsquery)
                    Index Searches: 1
                    Buffers: shared hit=5
Planning:
  Buffers: shared hit=1
Planning Time: 0.266 ms
Execution Time: 0.094 ms
```

## Q2: Storefront Catalogue Browse by Category & Store (Partial B-Tree — T4.1)
- **Target Index:** `idx_products_published_browse`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=0.28..69.75 rows=20 width=71) (actual time=0.021..0.045 rows=20.00 loops=1)
  Buffers: shared hit=22
  ->  Index Scan using idx_products_published_browse on products  (cost=0.28..132.28 rows=38 width=71) (actual time=0.020..0.042 rows=20.00 loops=1)
        Index Cond: ((category_id = '40000000-0000-4000-8000-000000000001'::uuid) AND (store_id = '20000000-0000-4000-8000-000000000001'::uuid))
        Index Searches: 1
        Buffers: shared hit=22
Planning:
  Buffers: shared hit=20
Planning Time: 0.305 ms
Execution Time: 0.067 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=0.28..69.75 rows=20 width=71) (actual time=0.019..0.045 rows=20.00 loops=1)
  Buffers: shared hit=22
  ->  Index Scan using idx_products_published_browse on products  (cost=0.28..132.28 rows=38 width=71) (actual time=0.018..0.041 rows=20.00 loops=1)
        Index Cond: ((category_id = '40000000-0000-4000-8000-000000000001'::uuid) AND (store_id = '20000000-0000-4000-8000-000000000001'::uuid))
        Index Searches: 1
        Buffers: shared hit=22
Planning:
  Buffers: shared hit=1
Planning Time: 0.292 ms
Execution Time: 0.068 ms
```

## Q3: Variant Price Range Filter (Partial Price B-Tree — T4.5)
- **Target Index:** `idx_variants_price_active`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=1.34..1.36 rows=9 width=34) (actual time=0.029..0.031 rows=8.00 loops=1)
  Buffers: shared hit=1
  ->  Sort  (cost=1.34..1.36 rows=9 width=34) (actual time=0.029..0.029 rows=8.00 loops=1)
        Sort Key: price_pkr
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=1
        ->  Seq Scan on variants  (cost=0.00..1.20 rows=9 width=34) (actual time=0.018..0.021 rows=8.00 loops=1)
              Filter: (is_active AND (deleted_at IS NULL) AND (price_pkr >= 500.00) AND (price_pkr <= 2000.00))
              Rows Removed by Filter: 5
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=70
Planning Time: 4.172 ms
Execution Time: 0.047 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=0.14..12.31 rows=9 width=34) (actual time=0.025..0.028 rows=8.00 loops=1)
  Buffers: shared hit=2
  ->  Index Scan using idx_variants_price_active on variants  (cost=0.14..12.31 rows=9 width=34) (actual time=0.024..0.026 rows=8.00 loops=1)
        Index Cond: ((price_pkr >= 500.00) AND (price_pkr <= 2000.00))
        Index Searches: 1
        Buffers: shared hit=2
Planning Time: 0.136 ms
Execution Time: 0.041 ms
```

## Q4: Customer Order History (Composite B-Tree — T5.4)
- **Target Index:** `idx_orders_user_created`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=1.03..1.04 rows=1 width=47) (actual time=0.058..0.059 rows=1.00 loops=1)
  Buffers: shared hit=1
  ->  Sort  (cost=1.03..1.04 rows=1 width=47) (actual time=0.056..0.057 rows=1.00 loops=1)
        Sort Key: created_at DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=1
        ->  Seq Scan on orders  (cost=0.00..1.02 rows=1 width=47) (actual time=0.037..0.038 rows=1.00 loops=1)
              Filter: (user_id = '30000000-0000-4000-8000-000000000007'::uuid)
              Rows Removed by Filter: 1
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=70
Planning Time: 4.695 ms
Execution Time: 0.091 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=0.13..8.14 rows=1 width=47) (actual time=0.029..0.030 rows=1.00 loops=1)
  Buffers: shared hit=2
  ->  Index Scan using idx_orders_user_created on orders  (cost=0.13..8.14 rows=1 width=47) (actual time=0.028..0.029 rows=1.00 loops=1)
        Index Cond: (user_id = '30000000-0000-4000-8000-000000000007'::uuid)
        Index Searches: 1
        Buffers: shared hit=2
Planning Time: 0.204 ms
Execution Time: 0.052 ms
```

## Q5: Seller Fulfillment Queue Scoped by Tenant & Store (Composite B-Tree — T6.4)
- **Target Index:** `idx_orders_tenant_store_status_created`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=1.04..1.05 rows=1 width=47) (actual time=0.027..0.028 rows=1.00 loops=1)
  Buffers: shared hit=1
  ->  Sort  (cost=1.04..1.05 rows=1 width=47) (actual time=0.026..0.027 rows=1.00 loops=1)
        Sort Key: created_at DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=1
        ->  Seq Scan on orders  (cost=0.00..1.03 rows=1 width=47) (actual time=0.018..0.019 rows=1.00 loops=1)
              Filter: ((tenant_id = '10000000-0000-4000-8000-000000000001'::uuid) AND (store_id = '20000000-0000-4000-8000-000000000001'::uuid) AND (status = 'delivered'::order_status))
              Rows Removed by Filter: 1
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=5
Planning Time: 0.248 ms
Execution Time: 0.052 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=0.13..8.15 rows=1 width=47) (actual time=0.035..0.037 rows=1.00 loops=1)
  Buffers: shared hit=2
  ->  Index Scan using idx_orders_tenant_store_status_created on orders  (cost=0.13..8.15 rows=1 width=47) (actual time=0.034..0.035 rows=1.00 loops=1)
        Index Cond: ((tenant_id = '10000000-0000-4000-8000-000000000001'::uuid) AND (store_id = '20000000-0000-4000-8000-000000000001'::uuid) AND (status = 'delivered'::order_status))
        Index Searches: 1
        Buffers: shared hit=2
Planning Time: 0.285 ms
Execution Time: 0.063 ms
```

## Q6: Atomic Inventory Lookup by Variant (Unique B-Tree — T4.4 / T5.3)
- **Target Index:** `inventory_variant_id_key`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Seq Scan on inventory  (cost=0.00..1.16 rows=1 width=24) (actual time=0.019..0.022 rows=1.00 loops=1)
  Filter: (variant_id = '60000000-0000-4000-8000-000000000001'::uuid)
  Rows Removed by Filter: 12
  Buffers: shared hit=1
Planning:
  Buffers: shared hit=39
Planning Time: 3.499 ms
Execution Time: 0.041 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Index Scan using inventory_variant_id_key on inventory  (cost=0.14..8.15 rows=1 width=24) (actual time=0.020..0.021 rows=1.00 loops=1)
  Index Cond: (variant_id = '60000000-0000-4000-8000-000000000001'::uuid)
  Index Searches: 1
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=1
Planning Time: 0.137 ms
Execution Time: 0.046 ms
```

## Q7: Expiring Inventory Reservations Sweep (Partial B-Tree — T5.6 / T6.8)
- **Target Index:** `idx_inventory_reservations_active_expiry`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=0.01..0.02 rows=1 width=44) (actual time=0.021..0.022 rows=0.00 loops=1)
  ->  Sort  (cost=0.01..0.02 rows=1 width=44) (actual time=0.020..0.020 rows=0.00 loops=1)
        Sort Key: expires_at
        Sort Method: quicksort  Memory: 25kB
        ->  Seq Scan on inventory_reservations  (cost=0.00..0.00 rows=1 width=44) (actual time=0.014..0.014 rows=0.00 loops=1)
              Filter: ((status = 'active'::reservation_status) AND (expires_at <= now()))
Planning:
  Buffers: shared hit=22 read=1
Planning Time: 0.502 ms
Execution Time: 0.042 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=0.13..8.14 rows=1 width=44) (actual time=0.009..0.009 rows=0.00 loops=1)
  Buffers: shared hit=1
  ->  Index Scan using idx_inventory_reservations_active_expiry on inventory_reservations  (cost=0.13..8.14 rows=1 width=44) (actual time=0.008..0.008 rows=0.00 loops=1)
        Index Cond: (expires_at <= now())
        Index Searches: 1
        Buffers: shared hit=1
Planning:
  Buffers: shared hit=2
Planning Time: 0.147 ms
Execution Time: 0.028 ms
```

## Q8: Payment Webhook Idempotency Lookup (Partial Unique B-Tree — T6.2)
- **Target Index:** `uq_payments_webhook_event_id`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Seq Scan on payments  (cost=0.00..1.02 rows=1 width=36) (actual time=0.018..0.019 rows=1.00 loops=1)
  Filter: (webhook_event_id = 'evt_seed_00001'::text)
  Rows Removed by Filter: 1
  Buffers: shared hit=1
Planning:
  Buffers: shared hit=60
Planning Time: 7.110 ms
Execution Time: 0.032 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Index Scan using uq_payments_webhook_event_id on payments  (cost=0.12..8.14 rows=1 width=36) (actual time=0.025..0.025 rows=1.00 loops=1)
  Index Cond: (webhook_event_id = 'evt_seed_00001'::text)
  Index Searches: 1
  Buffers: shared hit=2
Planning Time: 0.169 ms
Execution Time: 0.046 ms
```

## Q9: Admin Audit Log Timeline by Tenant (Composite B-Tree — T3.6)
- **Target Index:** `idx_audit_log_tenant_created`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=1.05..1.05 rows=2 width=59) (actual time=0.027..0.028 rows=2.00 loops=1)
  Buffers: shared hit=1
  ->  Sort  (cost=1.05..1.05 rows=2 width=59) (actual time=0.026..0.027 rows=2.00 loops=1)
        Sort Key: created_at DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=1
        ->  Seq Scan on audit_log  (cost=0.00..1.04 rows=2 width=59) (actual time=0.018..0.019 rows=2.00 loops=1)
              Filter: (tenant_id = '10000000-0000-4000-8000-000000000001'::uuid)
              Rows Removed by Filter: 1
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=45
Planning Time: 3.502 ms
Execution Time: 0.049 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=0.13..12.17 rows=2 width=59) (actual time=0.025..0.027 rows=2.00 loops=1)
  Buffers: shared hit=2
  ->  Index Scan using idx_audit_log_tenant_created on audit_log  (cost=0.13..12.17 rows=2 width=59) (actual time=0.024..0.025 rows=2.00 loops=1)
        Index Cond: (tenant_id = '10000000-0000-4000-8000-000000000001'::uuid)
        Index Searches: 1
        Buffers: shared hit=2
Planning Time: 0.150 ms
Execution Time: 0.041 ms
```

## Q10: Verified Product Reviews Sorted Newest First (Partial B-Tree — T7.3)
- **Target Index:** `idx_reviews_product_created`

**Default `EXPLAIN (ANALYZE, BUFFERS)`:**
```text
Limit  (cost=1.02..1.03 rows=1 width=66) (actual time=0.019..0.019 rows=1.00 loops=1)
  Buffers: shared hit=1
  ->  Sort  (cost=1.02..1.03 rows=1 width=66) (actual time=0.018..0.019 rows=1.00 loops=1)
        Sort Key: created_at DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=1
        ->  Seq Scan on reviews  (cost=0.00..1.01 rows=1 width=66) (actual time=0.013..0.014 rows=1.00 loops=1)
              Filter: ((deleted_at IS NULL) AND (product_id = '50000000-0000-4000-8000-000000000001'::uuid))
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=47
Planning Time: 2.371 ms
Execution Time: 0.034 ms
```

**Index Plan Proof (`SET LOCAL enable_seqscan = off`):**
```text
Limit  (cost=0.12..8.14 rows=1 width=66) (actual time=0.021..0.023 rows=1.00 loops=1)
  Buffers: shared hit=2
  ->  Index Scan using idx_reviews_product_created on reviews  (cost=0.12..8.14 rows=1 width=66) (actual time=0.021..0.021 rows=1.00 loops=1)
        Index Cond: (product_id = '50000000-0000-4000-8000-000000000001'::uuid)
        Index Searches: 1
        Buffers: shared hit=2
Planning Time: 0.095 ms
Execution Time: 0.034 ms
```
