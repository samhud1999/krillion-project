/**
 * Environment configuration. Reads a `.env` file from the project root when
 * present (never overriding variables already in the environment), then
 * normalises everything the server needs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from './paths.js';

export interface Env {
  port: number;
  /** canonical public URL (no trailing slash) if configured */
  publicUrl?: string;
  databaseUrl?: string;
  allowedOrigins: string[];
  hostPin?: string;
  logLevel: string;
  nodeEnv: string;
}

export function loadDotEnv(file = join(projectRoot(), '.env')): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadEnv(): Env {
  loadDotEnv();
  const port = Number.parseInt(process.env.PORT ?? '8787', 10);
  const publicUrl = (process.env.PUBLIC_URL ?? '').trim().replace(/\/+$/, '') || undefined;
  const databaseUrl = (process.env.DATABASE_URL ?? '').trim() || undefined;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);
  const hostPin = (process.env.HOST_PIN ?? '').trim() || undefined;
  return {
    port: Number.isFinite(port) && port > 0 ? port : 8787,
    publicUrl,
    databaseUrl,
    allowedOrigins,
    hostPin,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}
