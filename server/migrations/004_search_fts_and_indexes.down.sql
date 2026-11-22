-- Migration 004 (DOWN): Drop search triggers, functions, and performance indexes

DROP INDEX IF EXISTS idx_user_sessions_user_active;
DROP INDEX IF EXISTS idx_memberships_user_active;
DROP INDEX IF EXISTS idx_audit_log_actor_created;
DROP INDEX IF EXISTS idx_audit_log_tenant_created;
DROP INDEX IF EXISTS idx_notifications_user_unread;
DROP INDEX IF EXISTS idx_cart_items_cart_id;
DROP INDEX IF EXISTS idx_carts_abandoned_lookup;
DROP INDEX IF EXISTS idx_reviews_product_created;
DROP INDEX IF EXISTS idx_refunds_order_id;
DROP INDEX IF EXISTS idx_shipments_store_status;
DROP INDEX IF EXISTS idx_shipments_order_id;
DROP INDEX IF EXISTS idx_payments_pending_reconcile;
DROP INDEX IF EXISTS idx_payments_order_status;
DROP INDEX IF EXISTS idx_order_status_history_order_created;
DROP INDEX IF EXISTS idx_order_items_store_product;
DROP INDEX IF EXISTS idx_order_items_order_id;
DROP INDEX IF EXISTS idx_orders_tenant_store_status_created;
DROP INDEX IF EXISTS idx_orders_user_created;
DROP INDEX IF EXISTS idx_inventory_reservations_active_expiry;
DROP INDEX IF EXISTS idx_inventory_store_low_stock;
DROP INDEX IF EXISTS idx_stores_active_tenant;
DROP INDEX IF EXISTS idx_variants_price_active;
DROP INDEX IF EXISTS idx_variants_product_price_active;
DROP INDEX IF EXISTS idx_products_tenant_store_status;
DROP INDEX IF EXISTS idx_products_published_browse;
DROP INDEX IF EXISTS idx_products_search_vector_gin;

DROP TRIGGER IF EXISTS trg_categories_search_refresh ON categories;
DROP FUNCTION IF EXISTS trg_categories_refresh_product_search();

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
DROP FUNCTION IF EXISTS trg_products_update_search_vector();
DROP FUNCTION IF EXISTS compute_product_search_vector(TEXT, UUID, TEXT);
