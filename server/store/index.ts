import { log } from '../log.js';
import { MemoryStore } from './memory.js';
import { PgStore } from './pg.js';
import type { Store } from './types.js';

export type { Store, SubmissionRow } from './types.js';
export { MemoryStore } from './memory.js';
export { PgStore } from './pg.js';

/** Postgres when DATABASE_URL is set (migrations run here), else in-memory. */
export async function createStore(databaseUrl?: string): Promise<Store> {
  if (!databaseUrl) {
    log.info('store: in-memory (set DATABASE_URL to persist games)');
    const store = new MemoryStore();
    await store.init();
    return store;
  }
  const store = new PgStore(databaseUrl);
  await store.init();
  return store;
}
