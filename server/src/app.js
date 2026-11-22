import express from 'express';
import { checkDatabaseHealth, getAppPool } from './db/pool.js';
import { createSearchRouter } from './modules/search/search.routes.js';

export function createApp({ appPool } = {}) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', async (_req, res) => {
    try {
      const db = await checkDatabaseHealth(appPool || getAppPool());
      return res.status(200).json({
        data: {
          status: db.ok ? 'ok' : 'degraded',
          database: db,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return res.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: err.message,
        },
      });
    }
  });

  app.use('/api/v1/products/search', createSearchRouter({ pool: appPool }));

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  return app;
}
