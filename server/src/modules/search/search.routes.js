import express from 'express';
import { getAppPool } from '../../db/pool.js';
import { searchQuerySchema } from './search.schema.js';
import { searchProducts } from './search.service.js';

/**
 * Create the Search Express router (T4.5).
 * Mount at `/api/v1/products/search`.
 */
export function createSearchRouter({ pool } = {}) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: firstIssue?.message || 'Invalid search query parameters',
        },
      });
    }

    try {
      const dbPool = pool || getAppPool();
      const result = await searchProducts(dbPool, parsed.data);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[search:error]', err.message);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute product search',
        },
      });
    }
  });

  return router;
}
