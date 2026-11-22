-- Migration 001 (DOWN): Drop shared trigger function and custom enum types

DROP FUNCTION IF EXISTS set_updated_at();

DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS refund_status;
DROP TYPE IF EXISTS shipment_status;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS reservation_status;
DROP TYPE IF EXISTS discount_type;
DROP TYPE IF EXISTS product_status;
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS store_status;
DROP TYPE IF EXISTS tenant_status;
