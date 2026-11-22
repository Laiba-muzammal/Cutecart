/**
 * Atomic inventory & expiring reservation helpers (shared with M4 T4.4 & M5 T5.3/T5.6,
 * and verified under concurrent race tests in M2 T2.6).
 */

/**
 * Atomically decrement available stock using a single conditional UPDATE.
 * Guarantees two concurrent buyers fighting for the last unit can NEVER oversell
 * or drive stock below zero.
 *
 * @param {import('pg').PoolClient} client - Active transaction client
 * @param {{ tenantId: string, storeId: string, variantId: string, quantity: number }} params
 * @returns {Promise<{ success: boolean, inventory?: object }>}
 */
export async function decrementStockAtomically(client, { tenantId, storeId, variantId, quantity }) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive integer');
  }

  const { rows } = await client.query(
    `UPDATE inventory
     SET stock_quantity = stock_quantity - $1,
         updated_at = NOW()
     WHERE tenant_id = $2
       AND store_id = $3
       AND variant_id = $4
       AND (stock_quantity - reserved_quantity) >= $1
     RETURNING id, variant_id, stock_quantity, reserved_quantity, low_stock_threshold`,
    [quantity, tenantId, storeId, variantId]
  );

  if (rows.length === 0) {
    return { success: false };
  }

  const inv = rows[0];
  return {
    success: true,
    inventory: inv,
    isLowStock: inv.stock_quantity - inv.reserved_quantity <= inv.low_stock_threshold,
  };
}

/**
 * Atomically reserve stock with a TTL (used during checkout hold before payment confirms).
 */
export async function reserveStockAtomically(
  client,
  { tenantId, storeId, variantId, cartId = null, orderId = null, quantity, ttlMinutes = 15 }
) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive integer');
  }

  const { rows: invRows } = await client.query(
    `UPDATE inventory
     SET reserved_quantity = reserved_quantity + $1,
         updated_at = NOW()
     WHERE tenant_id = $2
       AND store_id = $3
       AND variant_id = $4
       AND (stock_quantity - reserved_quantity) >= $1
     RETURNING id, stock_quantity, reserved_quantity`,
    [quantity, tenantId, storeId, variantId]
  );

  if (invRows.length === 0) {
    return { success: false };
  }

  const { rows: resRows } = await client.query(
    `INSERT INTO inventory_reservations (
       tenant_id, store_id, variant_id, cart_id, order_id, quantity, status, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW() + ($7 || ' minutes')::interval)
     RETURNING *`,
    [tenantId, storeId, variantId, cartId, orderId, quantity, String(ttlMinutes)]
  );

  return { success: true, reservation: resRows[0], inventory: invRows[0] };
}

/**
 * Release all expired active inventory reservations in one atomic query.
 * Designed to be executed on a schedule by the pg-boss background job queue (T6.8 / T5.6).
 */
export async function releaseExpiredReservations(client) {
  const { rows } = await client.query(`
    WITH expired AS (
      UPDATE inventory_reservations
      SET status = 'expired',
          updated_at = NOW()
      WHERE status = 'active'
        AND expires_at <= NOW()
      RETURNING id, tenant_id, store_id, variant_id, quantity
    ),
    aggregated AS (
      SELECT tenant_id, store_id, variant_id, SUM(quantity)::int AS total_qty
      FROM expired
      GROUP BY tenant_id, store_id, variant_id
    ),
    restored AS (
      UPDATE inventory i
      SET reserved_quantity = GREATEST(0, i.reserved_quantity - a.total_qty),
          updated_at = NOW()
      FROM aggregated a
      WHERE i.tenant_id = a.tenant_id
        AND i.store_id = a.store_id
        AND i.variant_id = a.variant_id
      RETURNING i.variant_id, a.total_qty
    )
    SELECT
      (SELECT COUNT(*)::int FROM expired) AS expired_count,
      COALESCE((SELECT SUM(total_qty)::int FROM restored), 0) AS released_units
  `);

  return {
    expiredCount: rows[0]?.expired_count ?? 0,
    releasedUnits: rows[0]?.released_units ?? 0,
  };
}
