-- Migration 003 (UP): Composite Foreign Keys, Least-Privilege Roles & Row-Level Security (T2.3)

-- ============================================================================
-- 1. COMPOSITE FOREIGN KEYS (Same-Tenant & Same-Store Referential Safety)
--    Guarantees an order_item, cart_item, inventory row, review, or refund
--    can NEVER reference a product/variant/order from another store or tenant.
-- ============================================================================

ALTER TABLE memberships
  ADD CONSTRAINT fk_memberships_store_same_tenant
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE products
  ADD CONSTRAINT fk_products_store_same_tenant
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE variants
  ADD CONSTRAINT fk_variants_product_same_store
  FOREIGN KEY (tenant_id, store_id, product_id) REFERENCES products(tenant_id, store_id, id) ON DELETE CASCADE;

ALTER TABLE inventory
  ADD CONSTRAINT fk_inventory_variant_same_store
  FOREIGN KEY (tenant_id, store_id, variant_id) REFERENCES variants(tenant_id, store_id, id) ON DELETE CASCADE;

ALTER TABLE carts
  ADD CONSTRAINT fk_carts_store_same_tenant
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE cart_items
  ADD CONSTRAINT fk_cart_items_cart_same_store
  FOREIGN KEY (tenant_id, store_id, cart_id) REFERENCES carts(tenant_id, store_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_cart_items_variant_same_store
  FOREIGN KEY (tenant_id, store_id, variant_id) REFERENCES variants(tenant_id, store_id, id) ON DELETE CASCADE;

ALTER TABLE coupons
  ADD CONSTRAINT fk_coupons_store_same_tenant
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_store_same_tenant
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_orders_coupon_same_store
  FOREIGN KEY (tenant_id, store_id, coupon_id) REFERENCES coupons(tenant_id, store_id, id) ON DELETE RESTRICT;

ALTER TABLE inventory_reservations
  ADD CONSTRAINT fk_inv_res_variant_same_store
  FOREIGN KEY (tenant_id, store_id, variant_id) REFERENCES variants(tenant_id, store_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_inv_res_cart_same_store
  FOREIGN KEY (tenant_id, store_id, cart_id) REFERENCES carts(tenant_id, store_id, id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_inv_res_order_same_store
  FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id) ON DELETE SET NULL;

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_order_same_store
  FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_order_items_product_same_store
  FOREIGN KEY (tenant_id, store_id, product_id) REFERENCES products(tenant_id, store_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_order_items_variant_same_store
  FOREIGN KEY (tenant_id, store_id, variant_id) REFERENCES variants(tenant_id, store_id, id) ON DELETE RESTRICT;

ALTER TABLE order_status_history
  ADD CONSTRAINT fk_order_status_history_order_same_store
  FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id) ON DELETE CASCADE;

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_order_same_store
  FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id) ON DELETE RESTRICT;

ALTER TABLE shipments
  ADD CONSTRAINT fk_shipments_order_same_store
  FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id) ON DELETE RESTRICT;

ALTER TABLE refunds
  ADD CONSTRAINT fk_refunds_order_same_store
  FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_refunds_payment_same_store
  FOREIGN KEY (tenant_id, store_id, payment_id) REFERENCES payments(tenant_id, store_id, id) ON DELETE RESTRICT;

ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_product_same_store
  FOREIGN KEY (tenant_id, store_id, product_id) REFERENCES products(tenant_id, store_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_reviews_order_same_store
  FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id) ON DELETE RESTRICT;

ALTER TABLE wishlist
  ADD CONSTRAINT fk_wishlist_product_same_store
  FOREIGN KEY (tenant_id, store_id, product_id) REFERENCES products(tenant_id, store_id, id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_store_same_tenant
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE audit_log
  ADD CONSTRAINT fk_audit_log_store_same_tenant
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE RESTRICT;

-- ============================================================================
-- 2. TRANSACTION-LOCAL TENANT CONTEXT HELPERS
--    Set via SET LOCAL app.current_tenant_id / app.current_store_id / etc.
--    Safe with pg.Pool because SET LOCAL resets automatically at COMMIT/ROLLBACK.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_current_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_store_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_current_guest_token()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_guest_token', true), '');
$$;

CREATE OR REPLACE FUNCTION app_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_role', true), ''), 'anonymous');
$$;

CREATE OR REPLACE FUNCTION app_is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_role() = 'platform_admin';
$$;

CREATE OR REPLACE FUNCTION app_matches_tenant_store(row_tenant_id UUID, row_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    app_is_platform_admin()
    OR (
      app_current_role() IN ('seller', 'staff')
      AND row_tenant_id = app_current_tenant_id()
      AND (app_current_store_id() IS NULL OR row_store_id = app_current_store_id())
    );
$$;

-- ============================================================================
-- 3. ROW-LEVEL SECURITY (RLS) ON ALL TENANT-SCOPED & USER-SCOPED TABLES
--    FORCE ROW LEVEL SECURITY ensures even table-accessing non-bypass roles
--    cannot escape isolation policies.
-- ============================================================================

-- tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_tenants_select ON tenants FOR SELECT USING (
  app_is_platform_admin()
  OR id = app_current_tenant_id()
  OR (status = 'active' AND deleted_at IS NULL)
);
CREATE POLICY pol_tenants_modify ON tenants FOR ALL USING (
  app_is_platform_admin()
) WITH CHECK (
  app_is_platform_admin()
);

-- stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_stores_public_select ON stores FOR SELECT USING (
  (status = 'active' AND deleted_at IS NULL)
  OR app_matches_tenant_store(tenant_id, id)
);
CREATE POLICY pol_stores_tenant_write ON stores FOR ALL USING (
  app_matches_tenant_store(tenant_id, id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, id)
);

-- memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_memberships_select ON memberships FOR SELECT USING (
  app_is_platform_admin()
  OR user_id = app_current_user_id()
  OR (app_current_role() IN ('seller', 'staff') AND tenant_id = app_current_tenant_id())
);
CREATE POLICY pol_memberships_write ON memberships FOR ALL USING (
  app_is_platform_admin()
  OR (app_current_role() = 'seller' AND tenant_id = app_current_tenant_id())
) WITH CHECK (
  app_is_platform_admin()
  OR (app_current_role() = 'seller' AND tenant_id = app_current_tenant_id())
);

-- products (anyone can browse published products of active stores)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_products_public_select ON products FOR SELECT USING (
  (
    status = 'published'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = products.store_id
        AND s.tenant_id = products.tenant_id
        AND s.status = 'active'
        AND s.deleted_at IS NULL
    )
  )
  OR app_matches_tenant_store(tenant_id, store_id)
);
CREATE POLICY pol_products_tenant_write ON products FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
);

-- variants
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_variants_public_select ON variants FOR SELECT USING (
  (
    is_active = TRUE
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM products p
      JOIN stores s ON s.id = p.store_id AND s.tenant_id = p.tenant_id
      WHERE p.id = variants.product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
        AND s.status = 'active'
        AND s.deleted_at IS NULL
    )
  )
  OR app_matches_tenant_store(tenant_id, store_id)
);
CREATE POLICY pol_variants_tenant_write ON variants FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
);

-- inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_inventory_public_select ON inventory FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM variants v
    JOIN products p ON p.id = v.product_id AND p.store_id = v.store_id AND p.tenant_id = v.tenant_id
    JOIN stores s ON s.id = p.store_id AND s.tenant_id = p.tenant_id
    WHERE v.id = inventory.variant_id
      AND v.is_active = TRUE
      AND v.deleted_at IS NULL
      AND p.status = 'published'
      AND p.deleted_at IS NULL
      AND s.status = 'active'
      AND s.deleted_at IS NULL
  )
  OR app_matches_tenant_store(tenant_id, store_id)
);
CREATE POLICY pol_inventory_tenant_write ON inventory FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
);

-- inventory_reservations
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_inv_res_access ON inventory_reservations FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND (
      EXISTS (SELECT 1 FROM carts c WHERE c.id = inventory_reservations.cart_id AND c.user_id = app_current_user_id())
      OR EXISTS (SELECT 1 FROM orders o WHERE o.id = inventory_reservations.order_id AND o.user_id = app_current_user_id())
    )
  )
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR app_current_role() = 'customer'
);

-- carts (strictly scoped to owner customer/guest or store tenant)
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_carts_access ON carts FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (user_id IS NOT NULL AND user_id = app_current_user_id())
  OR (guest_token IS NOT NULL AND guest_token = app_current_guest_token())
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (user_id IS NOT NULL AND user_id = app_current_user_id())
  OR (guest_token IS NOT NULL AND guest_token = app_current_guest_token())
);

-- cart_items
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_cart_items_access ON cart_items FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR EXISTS (
    SELECT 1 FROM carts c
    WHERE c.id = cart_items.cart_id
      AND (
        (c.user_id IS NOT NULL AND c.user_id = app_current_user_id())
        OR (c.guest_token IS NOT NULL AND c.guest_token = app_current_guest_token())
      )
  )
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR EXISTS (
    SELECT 1 FROM carts c
    WHERE c.id = cart_items.cart_id
      AND (
        (c.user_id IS NOT NULL AND c.user_id = app_current_user_id())
        OR (c.guest_token IS NOT NULL AND c.guest_token = app_current_guest_token())
      )
  )
);

-- coupons
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_coupons_select ON coupons FOR SELECT USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND is_active = TRUE)
);
CREATE POLICY pol_coupons_write ON coupons FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
);

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_orders_select ON orders FOR SELECT USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND user_id = app_current_user_id())
);
CREATE POLICY pol_orders_insert ON orders FOR INSERT WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND user_id = app_current_user_id())
);
CREATE POLICY pol_orders_update ON orders FOR UPDATE USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND user_id = app_current_user_id())
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND user_id = app_current_user_id())
);
CREATE POLICY pol_orders_delete ON orders FOR DELETE USING (
  app_is_platform_admin()
);

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_order_items_select ON order_items FOR SELECT USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = app_current_user_id())
  )
);
CREATE POLICY pol_order_items_insert ON order_items FOR INSERT WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = app_current_user_id())
  )
);

-- order_status_history
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_order_status_history_select ON order_status_history FOR SELECT USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_status_history.order_id AND o.user_id = app_current_user_id())
  )
);
CREATE POLICY pol_order_status_history_insert ON order_status_history FOR INSERT WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_status_history.order_id AND o.user_id = app_current_user_id())
  )
);

-- payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_payments_select ON payments FOR SELECT USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.order_id AND o.user_id = app_current_user_id())
  )
);
CREATE POLICY pol_payments_write ON payments FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.order_id AND o.user_id = app_current_user_id())
  )
);

-- shipments
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_shipments_select ON shipments FOR SELECT USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (
    app_current_role() = 'customer'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = shipments.order_id AND o.user_id = app_current_user_id())
  )
);
CREATE POLICY pol_shipments_write ON shipments FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
);

-- refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_refunds_select ON refunds FOR SELECT USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND requested_by = app_current_user_id())
);
CREATE POLICY pol_refunds_insert ON refunds FOR INSERT WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND requested_by = app_current_user_id())
);
CREATE POLICY pol_refunds_update ON refunds FOR UPDATE USING (
  app_matches_tenant_store(tenant_id, store_id)
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
);

-- reviews (public read for non-deleted reviews of published products; write by owner or tenant)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_reviews_public_select ON reviews FOR SELECT USING (
  (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM products p
      JOIN stores s ON s.id = p.store_id AND s.tenant_id = p.tenant_id
      WHERE p.id = reviews.product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
        AND s.status = 'active'
        AND s.deleted_at IS NULL
    )
  )
  OR app_matches_tenant_store(tenant_id, store_id)
  OR user_id = app_current_user_id()
);
CREATE POLICY pol_reviews_write ON reviews FOR ALL USING (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND user_id = app_current_user_id())
) WITH CHECK (
  app_matches_tenant_store(tenant_id, store_id)
  OR (app_current_role() = 'customer' AND user_id = app_current_user_id())
);

-- wishlist
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_wishlist_access ON wishlist FOR ALL USING (
  app_is_platform_admin() OR user_id = app_current_user_id()
) WITH CHECK (
  app_is_platform_admin() OR user_id = app_current_user_id()
);

-- addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_addresses_access ON addresses FOR ALL USING (
  app_is_platform_admin() OR user_id = app_current_user_id()
) WITH CHECK (
  app_is_platform_admin() OR user_id = app_current_user_id()
);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_notifications_select ON notifications FOR SELECT USING (
  app_is_platform_admin()
  OR user_id = app_current_user_id()
  OR (tenant_id IS NOT NULL AND app_matches_tenant_store(tenant_id, store_id))
);
CREATE POLICY pol_notifications_write ON notifications FOR ALL USING (
  app_is_platform_admin()
  OR user_id = app_current_user_id()
  OR (tenant_id IS NOT NULL AND app_matches_tenant_store(tenant_id, store_id))
) WITH CHECK (
  app_is_platform_admin()
  OR user_id = app_current_user_id()
  OR (tenant_id IS NOT NULL AND app_matches_tenant_store(tenant_id, store_id))
);

-- audit_log (tenant-isolated read; append-only insert; no update/delete)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY pol_audit_log_select ON audit_log FOR SELECT USING (
  app_is_platform_admin()
  OR (tenant_id IS NOT NULL AND app_matches_tenant_store(tenant_id, store_id))
);
CREATE POLICY pol_audit_log_insert ON audit_log FOR INSERT WITH CHECK (
  app_is_platform_admin()
  OR tenant_id IS NULL
  OR tenant_id = app_current_tenant_id()
);

-- ============================================================================
-- 4. LEAST-PRIVILEGE DATABASE ROLES
--    - cutecart_app: runtime CRUD only (NO DDL, NOBYPASSRLS, append-only audit_log)
--    - cutecart_readonly: SELECT only (NO writes, NOBYPASSRLS)
-- ============================================================================

DO $$
DECLARE
  v_app_pw TEXT := COALESCE(NULLIF(current_setting('app.role_app_password', true), ''), 'cutecart_app_dev_password');
  v_ro_pw  TEXT := COALESCE(NULLIF(current_setting('app.role_readonly_password', true), ''), 'cutecart_readonly_dev_password');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cutecart_app') THEN
    EXECUTE format(
      'CREATE ROLE cutecart_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
      v_app_pw
    );
  ELSE
    EXECUTE format('ALTER ROLE cutecart_app WITH LOGIN PASSWORD %L NOBYPASSRLS', v_app_pw);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cutecart_readonly') THEN
    EXECUTE format(
      'CREATE ROLE cutecart_readonly LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
      v_ro_pw
    );
  ELSE
    EXECUTE format('ALTER ROLE cutecart_readonly WITH LOGIN PASSWORD %L NOBYPASSRLS', v_ro_pw);
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO cutecart_app, cutecart_readonly;
REVOKE CREATE ON SCHEMA public FROM cutecart_app, cutecart_readonly;

-- App runtime privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, users, user_sessions, stores, memberships, categories,
  products, variants, inventory, inventory_reservations,
  carts, cart_items, coupons, orders, order_items, order_status_history,
  payments, shipments, refunds, reviews, wishlist, addresses, notifications
TO cutecart_app;

-- audit_log is strictly APPEND-ONLY for the application runtime role
REVOKE ALL ON audit_log FROM cutecart_app;
GRANT SELECT, INSERT ON audit_log TO cutecart_app;

-- Read-only reporting role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cutecart_readonly;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM cutecart_readonly;

GRANT EXECUTE ON FUNCTION
  app_current_tenant_id(),
  app_current_store_id(),
  app_current_user_id(),
  app_current_guest_token(),
  app_current_role(),
  app_is_platform_admin(),
  app_matches_tenant_store(UUID, UUID)
TO cutecart_app, cutecart_readonly;
