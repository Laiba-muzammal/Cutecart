# CuteCart Data Retention, Soft-Delete & MongoDB Sunset Policy (T2.7)

**Owner:** M2 (Database, Search, Background Jobs)  
**Applies To:** All PostgreSQL tables in CuteCart & legacy MongoDB removal

---

## 1. Soft-Delete vs. Hard-Delete Policy

| Table Group | Deletion Strategy | Rationale |
|---|---|---|
| `tenants`, `stores`, `products`, `variants`, `reviews` | **Soft Delete (`deleted_at`)** | Historical `orders`, `order_items`, and invoices still reference these records via foreign keys. Setting `deleted_at = NOW()` hides them from public browse/search while preserving accounting integrity. |
| `users` | **Soft Delete + PII Anonymization** | Supports T3.9 ("Delete my account") without breaking historical orders or audit trails. On account deletion: set `deleted_at = NOW()`, replace `email` with `deleted-<uuid>@anonymized.local`, `username = NULL`, `full_name = 'Deleted User'`, `phone = NULL`, `avatar_url = NULL`, `password_hash = 'ANONYMIZED'`, `totp_secret_encrypted = NULL`, and revoke all `user_sessions`. |
| `carts`, `cart_items`, `wishlist`, `addresses`, `user_sessions` | **Hard Delete** | Ephemeral or user-owned operational state with no financial/legal retention requirement. |
| `orders`, `order_items`, `order_status_history`, `payments`, `shipments`, `refunds` | **Never Hard-Deleted (Immutable Ledger)** | Required for tax, invoices, chargebacks, refunds, and financial audits. Shipping address PII on `orders.shipping_address` is scrubbed after the legal retention window. |
| `audit_log` | **Append-Only (No UPDATE / DELETE)** | `UPDATE` and `DELETE` are revoked from `cutecart_app`. Archived/pruned only by DBA/migrator role after retention expiry. |

---

## 2. Retention Schedule (Automated via `pg-boss` Scheduled Jobs)

| Data Category | Active Retention | Post-Retention Action |
|---|---|---|
| Guest & expired `carts` | 30 days past `expires_at` | Hard delete via nightly `pg-boss` sweep |
| Expired `inventory_reservations` | 15 minutes active TTL; 30 days history | Expire every 1 min (release stock); purge rows > 30 days |
| Revoked/expired `user_sessions` | 30 days past expiry | Hard delete via weekly `pg-boss` job |
| `notifications` (read/sent) | 90 days | Hard delete or archive |
| Soft-deleted `products` / `variants` (unreferenced by orders) | 180 days | Eligible for hard cleanup |
| `orders`, `payments`, `refunds`, `shipments` | **7 years** (Pakistani commercial/tax record standard) | Anonymize `shipping_address` PII after 7 years; keep financial totals |
| `audit_log` | **2 years** hot in PostgreSQL (5 years cold backup) | Partition/archive by year via DBA script |

---

## 3. Privacy & User Rights ("Export My Data" & "Delete My Account" — T3.9)

- **Export:** Queries `users`, `addresses`, `orders` (+ `order_items`), `reviews`, `wishlist`, `notifications`, and `memberships` scoped strictly to `user_id = app_current_user_id()`, excluding `password_hash` and `totp_secret_encrypted`.
- **Delete:** Executed in a single transaction:
  1. Revoke all `user_sessions`.
  2. Delete `addresses`, `wishlist`, active `carts`, and `notifications`.
  3. Deactivate `memberships` (`is_active = FALSE`).
  4. Anonymize `users` row and set `deleted_at = NOW()`.
  5. Record `user.account_deleted` event in `audit_log`.

---

## 4. Legacy MongoDB Migration & Removal (T2.7)

The legacy prototype stored users in MongoDB (`auth_welab.users` with `{ username, password }`, bcrypt cost 10).

### Migration Script
Run the idempotent migration script in `server/scripts/migrate-mongo-users.js`:

```bash
# Preview migration without writing
node server/scripts/migrate-mongo-users.js --dry-run

# Migrate from JSON export, live MongoDB, or recreate legacy test users
npm run db:migrate-mongo-users
```

- Maps legacy `username` to `users.username` and synthesizes a deterministic placeholder email (`<username>@migrated.cutecart.local`) when the legacy record lacks an email.
- Preserves existing bcrypt hashes and sets `needs_password_rehash = TRUE` so M3's login flow automatically upgrades them to bcrypt cost 12 on next successful sign-in.
- Safe to run multiple times (`ON CONFLICT DO NOTHING`).

### MongoDB Removal Checklist (completed once M3 merges T3.1)
1. Run `npm run db:migrate-mongo-users` against staging/production and verify row counts.
2. Remove `mongoose` from `package.json` and delete legacy `backend/models/User.js`.
3. Remove `MONGODB_URL` / `MONGODB_URI` / `MONGODB_DB` from `.env.example` and deployment secrets.
4. Confirm zero runtime imports of `mongoose` or `mongodb` remain in `server/`.
