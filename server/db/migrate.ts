/**
 * Plain-SQL migrations. Each file in server/db/migrations runs once, in name
 * order, inside a transaction, and is recorded in `_migrations`. Safe to run
 * on every boot.
 *
 *   npm run db:migrate        (uses DATABASE_URL from the environment or .env)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../env.js';
import { log } from '../log.js';
import { MIGRATIONS_DIR } from '../paths.js';
import { createPool, type Pool } from './client.js';

export async function runMigrations(pool: Pool, dir = MIGRATIONS_DIR()): Promise<string[]> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    // Serialise concurrent boots (e.g. two replicas starting at once) before
    // touching any table, so even the bookkeeping table is created exactly once.
    await client.query('SELECT pg_advisory_lock(727001)');
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      const done = new Set(
        (await client.query<{ name: string }>('SELECT name FROM _migrations')).rows.map((r) => r.name),
      );
      for (const file of files) {
        if (done.has(file)) continue;
        const sql = readFileSync(join(dir, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw new Error(`migration ${file} failed: ${(e as Error).message}`);
        }
        applied.push(file);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(727001)');
    }
  } finally {
    client.release();
  }
  return applied;
}

async function main(): Promise<void> {
  const env = loadEnv();
  log.setLevel(env.logLevel);
  if (!env.databaseUrl) {
    log.error('DATABASE_URL is not set — nothing to migrate');
    process.exit(2);
  }
  const pool = createPool(env.databaseUrl);
  try {
    const applied = await runMigrations(pool);
    log.info(applied.length ? 'migrations applied' : 'database already up to date', { applied });
  } finally {
    await pool.end();
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e) => {
    log.error('migration failed', { error: (e as Error).message });
    process.exit(1);
  });
}
