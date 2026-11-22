import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestPools, ensureMigratedAndSeeded, closeTestPools } from './helpers/testDb.js';

describe('T4.5 — Full-Text Search API (/api/v1/products/search)', () => {
  let pools;
  let app;

  beforeAll(async () => {
    pools = createTestPools();
    await ensureMigratedAndSeeded(pools.migratorPool);
    app = createApp({ appPool: pools.appPool });
  });

  afterAll(async () => {
    await closeTestPools(pools);
  });

  it('searches by product name, description, and category while excluding draft products', async () => {
    // Search by product name
    const byName = await request(app).get('/api/v1/products/search?q=sakura+notebook');
    expect(byName.status).toBe(200);
    expect(byName.body.data.length).toBeGreaterThanOrEqual(1);
    expect(byName.body.data[0].slug).toBe('sakura-bloom-hardcover-notebook');
    expect(byName.body.data[0].currency).toBe('PKR');
    expect(byName.body.data[0].price).toMatch(/^\d+\.\d{2}$/);
    expect(byName.body.meta.currency).toBe('PKR');

    // Search by category name ("stickers")
    const byCategoryWord = await request(app).get('/api/v1/products/search?q=stickers');
    expect(byCategoryWord.status).toBe(200);
    expect(byCategoryWord.body.data.some((p) => p.category.slug === 'stickers')).toBe(true);

    // Search by description keyword ("calligraphy")
    const byDesc = await request(app).get('/api/v1/products/search?q=calligraphy');
    expect(byDesc.status).toBe(200);
    expect(byDesc.body.data.length).toBeGreaterThanOrEqual(2);

    // Draft product ("sketchbook") must NEVER appear in public search
    const draftSearch = await request(app).get('/api/v1/products/search?q=sketchbook');
    expect(draftSearch.status).toBe(200);
    expect(draftSearch.body.data).toHaveLength(0);
  });

  it('filters by category, store, and PKR price range and sorts by price & name', async () => {
    const filtered = await request(app).get(
      '/api/v1/products/search?minPrice=500&maxPrice=1500&sort=price_asc'
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.length).toBeGreaterThan(0);

    const prices = filtered.body.data.map((p) => Number(p.price));
    for (const price of prices) {
      expect(price).toBeGreaterThanOrEqual(500);
      expect(price).toBeLessThanOrEqual(1500);
    }
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);

    // Category filter + name_asc sort
    const byCat = await request(app).get(
      '/api/v1/products/search?category=pencil-cases&sort=name_asc'
    );
    expect(byCat.status).toBe(200);
    expect(byCat.body.data.length).toBeGreaterThanOrEqual(1);
    expect(byCat.body.data.every((p) => p.category.slug === 'pencil-cases')).toBe(true);
  });

  it('validates pagination and price bounds with standard error envelope', async () => {
    const tooLarge = await request(app).get('/api/v1/products/search?pageSize=101');
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.error.code).toBe('VALIDATION_ERROR');

    const badPriceRange = await request(app).get(
      '/api/v1/products/search?minPrice=3000&maxPrice=500'
    );
    expect(badPriceRange.status).toBe(400);
    expect(badPriceRange.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('exposes /api/health verifying live PostgreSQL connectivity', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database.ok).toBe(true);
  });
});
