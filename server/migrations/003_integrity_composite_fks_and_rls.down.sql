-- Migration 003 (DOWN): Revoke role grants, disable RLS policies, drop composite FKs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cutecart_app') THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM cutecart_app;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM cutecart_app;
    REVOKE USAGE ON SCHEMA public FROM cutecart_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cutecart_readonly') THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM cutecart_readonly;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM cutecart_readonly;
    REVOKE USAGE ON SCHEMA public FROM cutecart_readonly;
  END IF;
END
$$;

-- Disable RLS & drop policies
DROP POLICY IF EXISTS pol_audit_log_insert ON audit_log;
DROP POLICY IF EXISTS pol_audit_log_select ON audit_log;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_notifications_write ON notifications;
DROP POLICY IF EXISTS pol_notifications_select ON notifications;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_addresses_access ON addresses;
ALTER TABLE addresses DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_wishlist_access ON wishlist;
ALTER TABLE wishlist DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_reviews_write ON reviews;
DROP POLICY IF EXISTS pol_reviews_public_select ON reviews;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_refunds_update ON refunds;
DROP POLICY IF EXISTS pol_refunds_insert ON refunds;
DROP POLICY IF EXISTS pol_refunds_select ON refunds;
ALTER TABLE refunds DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_shipments_write ON shipments;
DROP POLICY IF EXISTS pol_shipments_select ON shipments;
ALTER TABLE shipments DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_payments_write ON payments;
DROP POLICY IF EXISTS pol_payments_select ON payments;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_order_status_history_insert ON order_status_history;
DROP POLICY IF EXISTS pol_order_status_history_select ON order_status_history;
ALTER TABLE order_status_history DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_order_items_insert ON order_items;
DROP POLICY IF EXISTS pol_order_items_select ON order_items;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_orders_delete ON orders;
DROP POLICY IF EXISTS pol_orders_update ON orders;
DROP POLICY IF EXISTS pol_orders_insert ON orders;
DROP POLICY IF EXISTS pol_orders_select ON orders;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_coupons_write ON coupons;
DROP POLICY IF EXISTS pol_coupons_select ON coupons;
ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_cart_items_access ON cart_items;
ALTER TABLE cart_items DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_carts_access ON carts;
ALTER TABLE carts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_inv_res_access ON inventory_reservations;
ALTER TABLE inventory_reservations DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_inventory_tenant_write ON inventory;
DROP POLICY IF EXISTS pol_inventory_public_select ON inventory;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_variants_tenant_write ON variants;
DROP POLICY IF EXISTS pol_variants_public_select ON variants;
ALTER TABLE variants DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_products_tenant_write ON products;
DROP POLICY IF EXISTS pol_products_public_select ON products;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_memberships_write ON memberships;
DROP POLICY IF EXISTS pol_memberships_select ON memberships;
ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_stores_tenant_write ON stores;
DROP POLICY IF EXISTS pol_stores_public_select ON stores;
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_tenants_modify ON tenants;
DROP POLICY IF EXISTS pol_tenants_select ON tenants;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- Drop helper functions
DROP FUNCTION IF EXISTS app_matches_tenant_store(UUID, UUID);
DROP FUNCTION IF EXISTS app_is_platform_admin();
DROP FUNCTION IF EXISTS app_current_role();
DROP FUNCTION IF EXISTS app_current_guest_token();
DROP FUNCTION IF EXISTS app_current_user_id();
DROP FUNCTION IF EXISTS app_current_store_id();
DROP FUNCTION IF EXISTS app_current_tenant_id();

-- Drop composite FKs
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS fk_audit_log_store_same_tenant;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_store_same_tenant;
ALTER TABLE wishlist DROP CONSTRAINT IF EXISTS fk_wishlist_product_same_store;
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS fk_reviews_order_same_store,
  DROP CONSTRAINT IF EXISTS fk_reviews_product_same_store;
ALTER TABLE refunds
  DROP CONSTRAINT IF EXISTS fk_refunds_payment_same_store,
  DROP CONSTRAINT IF EXISTS fk_refunds_order_same_store;
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS fk_shipments_order_same_store;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_order_same_store;
ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS fk_order_status_history_order_same_store;
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS fk_order_items_variant_same_store,
  DROP CONSTRAINT IF EXISTS fk_order_items_product_same_store,
  DROP CONSTRAINT IF EXISTS fk_order_items_order_same_store;
ALTER TABLE inventory_reservations
  DROP CONSTRAINT IF EXISTS fk_inv_res_order_same_store,
  DROP CONSTRAINT IF EXISTS fk_inv_res_cart_same_store,
  DROP CONSTRAINT IF EXISTS fk_inv_res_variant_same_store;
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS fk_orders_coupon_same_store,
  DROP CONSTRAINT IF EXISTS fk_orders_store_same_tenant;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS fk_coupons_store_same_tenant;
ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS fk_cart_items_variant_same_store,
  DROP CONSTRAINT IF EXISTS fk_cart_items_cart_same_store;
ALTER TABLE carts DROP CONSTRAINT IF EXISTS fk_carts_store_same_tenant;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS fk_inventory_variant_same_store;
ALTER TABLE variants DROP CONSTRAINT IF EXISTS fk_variants_product_same_store;
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_store_same_tenant;
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS fk_memberships_store_same_tenant;
