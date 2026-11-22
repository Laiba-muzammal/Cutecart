-- Migration 002 (UP): Schema v1 — All 22 core CuteCart tables + 2 operational support tables
-- Rules enforced:
--   - UUID primary keys (gen_random_uuid())
--   - Money as NUMERIC(12, 2) in PKR (never floating point)
--   - Timestamps as TIMESTAMPTZ (UTC ISO 8601)
--   - Single-store carts and single-store orders

-- 1. tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) >= 2),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status tenant_status NOT NULL DEFAULT 'active',
  contact_email TEXT NOT NULL CHECK (POSITION('@' IN contact_email) > 1),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (POSITION('@' IN email) > 1),
  username TEXT,
  password_hash TEXT NOT NULL CHECK (LENGTH(password_hash) > 0),
  needs_password_rehash BOOLEAN NOT NULL DEFAULT FALSE,
  full_name TEXT NOT NULL CHECK (LENGTH(TRIM(full_name)) >= 1),
  phone TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
  totp_secret_encrypted TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));
CREATE UNIQUE INDEX uq_users_username_lower ON users (LOWER(username)) WHERE username IS NOT NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Support table A: user_sessions (M3 T3.1 refresh tokens & T3.7 "log out everywhere")
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at)
);

-- 3. stores
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) >= 2),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT,
  logo_url TEXT,
  status store_status NOT NULL DEFAULT 'active',
  currency CHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  city TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_stores_tenant_id UNIQUE (tenant_id, id)
);

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. memberships
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id UUID,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_memberships_tenant_user_role_no_store
  ON memberships (tenant_id, user_id, role)
  WHERE store_id IS NULL;

CREATE UNIQUE INDEX uq_memberships_tenant_store_user_role
  ON memberships (tenant_id, store_id, user_id, role)
  WHERE store_id IS NOT NULL;

CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) >= 2),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  icon TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) >= 2),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT NOT NULL DEFAULT '',
  status product_status NOT NULL DEFAULT 'draft',
  image_url TEXT,
  gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  seo_title TEXT,
  seo_description TEXT,
  search_vector TSVECTOR,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_products_store_slug UNIQUE (store_id, slug),
  CONSTRAINT uq_products_tenant_store_id UNIQUE (tenant_id, store_id, id)
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. variants (SKUs with price in PKR)
CREATE TABLE variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  sku TEXT NOT NULL CHECK (LENGTH(TRIM(sku)) >= 2),
  title TEXT NOT NULL DEFAULT 'Default',
  price_pkr NUMERIC(12, 2) NOT NULL CHECK (price_pkr > 0),
  compare_at_price_pkr NUMERIC(12, 2) CHECK (compare_at_price_pkr IS NULL OR compare_at_price_pkr >= price_pkr),
  currency CHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  color TEXT,
  size TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_variants_store_sku UNIQUE (store_id, sku),
  CONSTRAINT uq_variants_tenant_store_id UNIQUE (tenant_id, store_id, id)
);

CREATE TRIGGER trg_variants_updated_at
  BEFORE UPDATE ON variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. inventory (1:1 per variant)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  variant_id UUID NOT NULL UNIQUE,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inventory_reserved_lte_stock CHECK (reserved_quantity <= stock_quantity)
);

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. carts (strictly one cart per store per customer or guest)
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_token TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  abandoned_notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_carts_owner CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL),
  CONSTRAINT uq_carts_tenant_store_id UNIQUE (tenant_id, store_id, id)
);

CREATE UNIQUE INDEX uq_carts_store_user ON carts (store_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_carts_store_guest ON carts (store_id, guest_token) WHERE guest_token IS NOT NULL;

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. cart_items
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  cart_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 100),
  custom_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cart_items_cart_variant UNIQUE (cart_id, variant_id)
);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. coupons (store-scoped promotions)
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  code TEXT NOT NULL CHECK (LENGTH(TRIM(code)) >= 2),
  discount_type discount_type NOT NULL,
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
  min_spend_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (min_spend_pkr >= 0),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_coupons_percent_bound CHECK (discount_type <> 'percent' OR discount_value <= 100.00),
  CONSTRAINT chk_coupons_usage_bound CHECK (max_uses IS NULL OR used_count <= max_uses),
  CONSTRAINT chk_coupons_date_range CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT uq_coupons_tenant_store_id UNIQUE (tenant_id, store_id, id)
);

CREATE UNIQUE INDEX uq_coupons_store_code_upper ON coupons (store_id, UPPER(code));

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 12. orders (strictly one store per order)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  coupon_id UUID,
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL,
  status order_status NOT NULL DEFAULT 'pending_payment',
  subtotal_pkr NUMERIC(12, 2) NOT NULL CHECK (subtotal_pkr >= 0),
  discount_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_pkr >= 0),
  shipping_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_pkr >= 0),
  tax_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_pkr >= 0),
  total_pkr NUMERIC(12, 2) NOT NULL CHECK (total_pkr >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  shipping_address JSONB NOT NULL,
  shipping_method TEXT NOT NULL DEFAULT 'standard',
  notes TEXT,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_orders_discount_lte_subtotal CHECK (discount_pkr <= subtotal_pkr),
  CONSTRAINT chk_orders_total_math CHECK (total_pkr = subtotal_pkr - discount_pkr + shipping_pkr + tax_pkr),
  CONSTRAINT uq_orders_store_user_idempotency UNIQUE (store_id, user_id, idempotency_key),
  CONSTRAINT uq_orders_tenant_store_id UNIQUE (tenant_id, store_id, id)
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Support table B: inventory_reservations (M4 T4.4 & M5 T5.6 expiring stock holds)
CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  cart_id UUID,
  order_id UUID,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status reservation_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at)
);

CREATE TRIGGER trg_inventory_reservations_updated_at
  BEFORE UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 13. order_items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  variant_sku TEXT NOT NULL,
  unit_price_pkr NUMERIC(12, 2) NOT NULL CHECK (unit_price_pkr > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_pkr NUMERIC(12, 2) NOT NULL CHECK (line_total_pkr > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  custom_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_order_items_line_total CHECK (line_total_pkr = unit_price_pkr * quantity)
);

-- 14. order_status_history
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. payments (never stores card numbers or CVV)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  provider TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('gateway', 'cod')),
  status payment_status NOT NULL DEFAULT 'pending',
  amount_pkr NUMERIC(12, 2) NOT NULL CHECK (amount_pkr > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  provider_payment_id TEXT,
  webhook_event_id TEXT,
  verified_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payments_tenant_store_id UNIQUE (tenant_id, store_id, id)
);

CREATE UNIQUE INDEX uq_payments_provider_payment_id
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX uq_payments_webhook_event_id
  ON payments (webhook_event_id)
  WHERE webhook_event_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 16. shipments
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  carrier TEXT NOT NULL DEFAULT 'mock_carrier',
  tracking_number TEXT,
  status shipment_status NOT NULL DEFAULT 'pending',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_shipments_carrier_tracking
  ON shipments (carrier, tracking_number)
  WHERE tracking_number IS NOT NULL;

CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 17. refunds
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  payment_id UUID NOT NULL,
  amount_pkr NUMERIC(12, 2) NOT NULL CHECK (amount_pkr > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  status refund_status NOT NULL DEFAULT 'requested',
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 3),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  provider_refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 18. reviews (verified buyer only, bound to an order in the same store)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT NOT NULL CHECK (LENGTH(TRIM(body)) >= 1),
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_reviews_user_product_order UNIQUE (user_id, product_id, order_id)
);

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 19. wishlist
CREATE TABLE wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
);

-- 20. addresses
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  recipient_name TEXT NOT NULL CHECK (LENGTH(TRIM(recipient_name)) >= 2),
  phone TEXT NOT NULL CHECK (LENGTH(TRIM(phone)) >= 7),
  line1 TEXT NOT NULL CHECK (LENGTH(TRIM(line1)) >= 3),
  line2 TEXT,
  city TEXT NOT NULL CHECK (LENGTH(TRIM(city)) >= 2),
  province TEXT NOT NULL CHECK (LENGTH(TRIM(province)) >= 2),
  postal_code TEXT,
  country CHAR(2) NOT NULL DEFAULT 'PK',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 21. notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  store_id UUID,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status notification_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. audit_log (append-only security & compliance log)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (LENGTH(TRIM(action)) >= 2),
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
