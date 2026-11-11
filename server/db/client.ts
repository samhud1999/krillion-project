/**
 * Postgres connection pool with the SSL handling hosted providers need.
 *
 *   DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require   (Neon, Supabase, Render)
 *   PGSSL=no-verify   accept a self-signed certificate
 *   PGSSL=disable     force plaintext (Railway's internal network, docker-compose)
 *   PGSSL_CA=/path/to/ca.pem   verify against a specific CA bundle
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

export type Pool = pg.Pool;

export function sslConfig(databaseUrl: string): pg.PoolConfig['ssl'] {
  const mode = (process.env.PGSSL ?? '').trim().toLowerCase();
  if (mode === 'disable' || mode === 'false' || mode === '0') return false;
  if (process.env.PGSSL_CA) return { ca: readFileSync(process.env.PGSSL_CA, 'utf8') };
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  if (mode === 'require' || mode === 'true' || mode === '1') return { rejectUnauthorized: true };
  // Otherwise let the URL decide (?sslmode=require is honoured by pg itself).
  void databaseUrl;
  return undefined;
}

export function createPool(databaseUrl: string): pg.Pool {
  const ssl = sslConfig(databaseUrl);
  return new pg.Pool({
    connectionString: databaseUrl,
    ...(ssl === undefined ? {} : { ssl }),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
