/**
 * Locates the project root (the folder holding package.json) from wherever this
 * module runs — `server/paths.ts` under tsx, or `dist/server/server/paths.js`
 * after a build — so data files resolve the same way in both.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedRoot: string | undefined;

export function projectRoot(): string {
  if (cachedRoot) return cachedRoot;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'shared'))) {
      cachedRoot = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cachedRoot = process.cwd();
  return cachedRoot;
}

export const BANK_DIR = (): string => join(projectRoot(), 'server', 'data', 'bank');
export const MIGRATIONS_DIR = (): string => join(projectRoot(), 'server', 'db', 'migrations');
export const CLIENT_DIST = (): string => join(projectRoot(), 'dist', 'client');
