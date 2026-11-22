-- Migration 004 (UP): Full-Text Search (T4.5) & Query-Justified Indexes (T2.5)

-- ============================================================================
-- 1. FULL-TEXT SEARCH VECTOR & TRIGGERS (product name=A, category=B, desc=C)
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_product_search_vector(
  p_name TEXT,
  p_category_id UUID,
  p_description TEXT
)
RETURNS TSVECTOR
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_name TEXT := '';
BEGIN
  IF p_category_id IS NOT NULL THEN
    SELECT name INTO v_category_name FROM categories WHERE id = p_category_id;
  END IF;

  RETURN
    setweight(to_tsvector('english', COALESCE(p_name, '')), 'A')
    || setweight(to_tsvector('english', COALESCE(v_category_name, '')), 'B')
    || setweight(to_tsvector('english', COALESCE(p_description, '')), 'C');
END;
$$;

CREATE OR REPLACE FUNCTION trg_products_update_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := compute_product_search_vector(NEW.name, NEW.category_id, NEW.description);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE OF name, description, category_id
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION trg_products_update_search_vector();

-- Keep product search vectors fresh if a category is renamed
CREATE OR REPLACE FUNCTION trg_categories_refresh_product_search()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE products
    SET search_vector = compute_product_search_vector(name, category_id, description)
    WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_categories_search_refresh
  AFTER UPDATE OF name ON categories
  FOR EACH ROW
  EXECUTE FUNCTION trg_categories_refresh_product_search();

-- Backfill existing rows if any
UPDATE products
SET search_vector = compute_product_search_vector(name, category_id, description)
WHERE search_vector IS NULL;

-- ============================================================================
-- 2. INDEXES JUSTIFIED BY REAL APPLICATION QUERIES (T2.5 & T4.5)
-- ============================================================================

-- Q1: Full-text search on published products (T4.5)
-- fastupdate = off keeps read latency predictable on read-heavy catalog queries
CREATE INDEX idx_products_search_vector_gin
  ON products USING GIN (search_vector)
  WITH (fastupdate = off)
  WHERE status = 'published' AND deleted_at IS NULL;

-- Q2: Storefront catalogue browse — filter by category/store & sort by newest (T4.1, T4.5)
CREATE INDEX idx_products_published_browse
  ON products (category_id, store_id, created_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

-- Q3: Seller dashboard product list scoped by tenant & store (T4.3)
CREATE INDEX idx_products_tenant_store_status
  ON products (tenant_id, store_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Q4: Price range filter & sort by price on active variants (T4.5, T4.2)
CREATE INDEX idx_variants_product_price_active
  ON variants (product_id, price_pkr ASC)
  WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE INDEX idx_variants_price_active
  ON variants (price_pkr ASC, product_id)
  WHERE is_active = TRUE AND deleted_at IS NULL;

-- Q5: Active stores lookup for storefront RLS & joins (T4.1, T4.5)
CREATE INDEX idx_stores_active_tenant
  ON stores (tenant_id, id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Q6: Atomic inventory update & low-stock alerts (T4.4, T5.3)
CREATE INDEX idx_inventory_store_low_stock
  ON inventory (tenant_id, store_id, variant_id)
  WHERE (stock_quantity - reserved_quantity) <= low_stock_threshold;

-- Q7: Scheduled job sweeping expired stock reservations (T5.6, T6.8)
CREATE INDEX idx_inventory_reservations_active_expiry
  ON inventory_reservations (expires_at ASC)
  WHERE status = 'active';

-- Q8: Customer order history (T5.4)
CREATE INDEX idx_orders_user_created
  ON orders (user_id, created_at DESC);

-- Q9: Seller / staff order fulfillment queue & reports (T5.4, T6.4, T6.7)
CREATE INDEX idx_orders_tenant_store_status_created
  ON orders (tenant_id, store_id, status, created_at DESC);

-- Q10: Order items lookup by order_id & top-products reporting (T5.4, T6.7)
CREATE INDEX idx_order_items_order_id
  ON order_items (order_id);

CREATE INDEX idx_order_items_store_product
  ON order_items (tenant_id, store_id, product_id);

-- Q11: Order status timeline lookup (T5.4)
CREATE INDEX idx_order_status_history_order_created
  ON order_status_history (order_id, created_at ASC);

-- Q12: Payment lookup by order & pending reconciliation job (T6.2, T6.3)
CREATE INDEX idx_payments_order_status
  ON payments (order_id, status);

CREATE INDEX idx_payments_pending_reconcile
  ON payments (created_at ASC)
  WHERE status IN ('pending', 'authorized');

-- Q13: Shipments lookup by order & store status (T6.4)
CREATE INDEX idx_shipments_order_id
  ON shipments (order_id);

CREATE INDEX idx_shipments_store_status
  ON shipments (tenant_id, store_id, status);

-- Q14: Refunds lookup by order/payment (T6.5)
CREATE INDEX idx_refunds_order_id
  ON refunds (order_id);

-- Q15: Verified product reviews list sorted newest first (T7.3)
CREATE INDEX idx_reviews_product_created
  ON reviews (product_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Q16: Abandoned-cart sweep & active cart items lookup (T5.1, T5.6)
CREATE INDEX idx_carts_abandoned_lookup
  ON carts (updated_at ASC)
  WHERE abandoned_notified_at IS NULL;

CREATE INDEX idx_cart_items_cart_id
  ON cart_items (cart_id);

-- Q17: Unread in-app notifications inbox (T7.1)
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Q18: Admin audit log viewer by tenant & timeline (T3.6)
CREATE INDEX idx_audit_log_tenant_created
  ON audit_log (tenant_id, created_at DESC);

CREATE INDEX idx_audit_log_actor_created
  ON audit_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- Q19: User memberships lookup during JWT/session authorization (T3.2)
CREATE INDEX idx_memberships_user_active
  ON memberships (user_id, tenant_id)
  WHERE is_active = TRUE;

-- Q20: Active user sessions lookup (T3.1, T3.7)
CREATE INDEX idx_user_sessions_user_active
  ON user_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

-- Allow cutecart_app & cutecart_readonly to invoke search vector helper during INSERT/UPDATE
GRANT EXECUTE ON FUNCTION compute_product_search_vector(TEXT, UUID, TEXT) TO cutecart_app, cutecart_readonly;
