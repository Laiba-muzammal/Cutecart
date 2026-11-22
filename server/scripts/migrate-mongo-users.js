import 'dotenv/config';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { getMigratorPool, withTransaction, closeAllPools } from '../src/db/pool.js';

/**
 * Legacy MongoDB -> PostgreSQL User Migration Script (T2.7).
 *
 * Legacy CuteCart stored users in MongoDB (`auth_welab.users` with `{ username, password }`,
 * bcrypt cost 10). This script supports three idempotent sources:
 *   1. JSON export file via `LEGACY_USERS_JSON_PATH` (or `--file path.json`)
 *   2. Live MongoDB via `LEGACY_MONGODB_URL` (dynamically imports `mongodb` if installed)
 *   3. Fallback recreation of legacy prototype test users when no live MongoDB exists
 *
 * Preserves existing bcrypt hashes and flags `needs_password_rehash = TRUE` for cost < 12
 * so M3's auth flow upgrades them transparently on next login.
 */

const FALLBACK_LEGACY_TEST_USERS = [
  { username: 'legacy_demo_buyer', fullName: 'Legacy Demo Buyer', plainPassword: 'LegacyUser#2026!' },
  { username: 'legacy_test_user', fullName: 'Legacy Test User', plainPassword: 'LegacyUser#2026!' },
];

function extractBcryptCost(hash) {
  if (typeof hash !== 'string') return 0;
  const match = hash.match(/^\$2[aby]\$(\d{2})\$/);
  return match ? Number(match[1]) : 0;
}

export async function normalizeLegacyUser(record, { testMode = false } = {}) {
  const username = String(record.username || '').trim();
  if (!username) {
    throw new Error('Legacy user record is missing username');
  }

  const email = record.email
    ? String(record.email).trim().toLowerCase()
    : `${username.toLowerCase().replace(/[^a-z0-9._-]/g, '_')}@migrated.cutecart.local`;

  let passwordHash = record.password || record.passwordHash || record.password_hash;
  let needsPasswordRehash = false;

  if (passwordHash && /^\$2[aby]\$\d{2}\$/.test(passwordHash)) {
    needsPasswordRehash = extractBcryptCost(passwordHash) < 12;
  } else {
    const cost = testMode ? 4 : 12;
    passwordHash = await bcrypt.hash(record.plainPassword || 'TempResetRequired#2026!', cost);
    needsPasswordRehash = false;
  }

  return {
    email,
    username,
    fullName: record.fullName || record.name || username,
    passwordHash,
    needsPasswordRehash,
    createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
  };
}

export async function migrateLegacyUsers(pool, records, { dryRun = false, testMode = false } = {}) {
  const normalized = [];
  for (const rec of records) {
    normalized.push(await normalizeLegacyUser(rec, { testMode }));
  }

  if (dryRun) {
    return { dryRun: true, total: normalized.length, inserted: 0, skipped: 0, preview: normalized.map((u) => ({ username: u.username, email: u.email, needsPasswordRehash: u.needsPasswordRehash })) };
  }

  let inserted = 0;
  let skipped = 0;

  await withTransaction(pool, async (client) => {
    for (const user of normalized) {
      const { rowCount } = await client.query(
        `INSERT INTO users (
           email, username, password_hash, needs_password_rehash,
           full_name, email_verified, created_at
         )
         VALUES ($1, $2, $3, $4, $5, FALSE, $6)
         ON CONFLICT (LOWER(email)) DO NOTHING`,
        [
          user.email,
          user.username,
          user.passwordHash,
          user.needsPasswordRehash,
          user.fullName,
          user.createdAt,
        ]
      );

      if (rowCount > 0) inserted += 1;
      else skipped += 1;
    }
  });

  return { dryRun: false, total: normalized.length, inserted, skipped };
}

async function loadRecordsFromSource(filePathArg) {
  const filePath = filePathArg || process.env.LEGACY_USERS_JSON_PATH;
  if (filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { source: `json:${filePath}`, records: Array.isArray(parsed) ? parsed : [] };
  }

  if (process.env.LEGACY_MONGODB_URL) {
    try {
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(process.env.LEGACY_MONGODB_URL);
      await client.connect();
      try {
        const db = client.db(process.env.LEGACY_MONGODB_DB || 'auth_welab');
        const records = await db.collection('users').find({}).toArray();
        return { source: 'mongodb', records };
      } finally {
        await client.close();
      }
    } catch (err) {
      throw new Error(
        `LEGACY_MONGODB_URL is set, but reading MongoDB failed (${err.message}). Export users to JSON and pass --file <path> instead.`,
        { cause: err }
      );
    }
  }

  return { source: 'fallback-recreation', records: FALLBACK_LEGACY_TEST_USERS };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  const fileFlagIdx = process.argv.indexOf('--file');
  const fileArg = fileFlagIdx !== -1 ? process.argv[fileFlagIdx + 1] : undefined;

  const pool = getMigratorPool();
  loadRecordsFromSource(fileArg)
    .then(async ({ source, records }) => {
      const result = await migrateLegacyUsers(pool, records, { dryRun });
      console.log(`[migrate-mongo-users] Source=${source}`, result);
    })
    .catch((err) => {
      console.error('[migrate-mongo-users:error]', err.message);
      process.exitCode = 1;
    })
    .finally(() => closeAllPools());
}
