-- Migration 001 (UP): Core enums and shared trigger helpers
-- Uses built-in gen_random_uuid() (PostgreSQL 13+) so no superuser extensions are required.

CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE store_status AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE user_role AS ENUM ('customer', 'staff', 'seller', 'platform_admin');
CREATE TYPE product_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE discount_type AS ENUM ('percent', 'fixed');
CREATE TYPE reservation_status AS ENUM ('active', 'committed', 'released', 'expired');

-- Exact required platform statuses (Team Work Plan, pp. 2-3)
CREATE TYPE order_status AS ENUM (
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'authorized',
  'completed',
  'failed',
  'refunded'
);

CREATE TYPE shipment_status AS ENUM (
  'pending',
  'packed',
  'shipped',
  'in_transit',
  'delivered',
  'failed',
  'returned'
);

CREATE TYPE refund_status AS ENUM (
  'requested',
  'approved',
  'rejected',
  'completed',
  'failed'
);

CREATE TYPE notification_channel AS ENUM ('email', 'in_app');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'read');

-- Shared trigger function to automatically maintain updated_at in UTC
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
