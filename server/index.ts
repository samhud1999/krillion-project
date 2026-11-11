/**
 * Separation Creek Krillion — single-process game server.
 *
 *   HTTP  : health, prompt list, built client with SPA fallback
 *   WS    : /ws — hosts and players
 *   Store : Postgres when DATABASE_URL is set, memory otherwise
 */
import type { Server as HttpServer } from 'node:http';
import { serve } from '@hono/node-server';
import { Bank } from './bank.js';
import { loadEnv } from './env.js';
import { createApp } from './http.js';
import { log } from './log.js';
import { BANK_DIR, CLIENT_DIST } from './paths.js';
import { RoomManager } from './rooms.js';
import { createStore } from './store/index.js';
import { Gateway } from './ws.js';

async function main(): Promise<void> {
  const env = loadEnv();
  log.setLevel(env.logLevel);
  const startedAt = Date.now();

  const bank = Bank.load(BANK_DIR());
  const store = await createStore(env.databaseUrl);
  const manager = new RoomManager({ bank, store });
  await manager.restore();

  let gateway: Gateway | undefined;
  const app = createApp({
    manager,
    bank,
    clientDir: CLIENT_DIST(),
    startedAt,
    connectionCount: () => gateway?.connectionCount() ?? 0,
  });

  const server = serve({ fetch: app.fetch, port: env.port, hostname: '0.0.0.0' }, (info) => {
    log.info('listening', {
      url: `http://localhost:${info.port}`,
      publicUrl: env.publicUrl ?? '(auto)',
      store: store.kind,
      bank: bank.source,
      prompts: bank.size(),
      hostPin: env.hostPin ? 'set' : 'off',
    });
  }) as HttpServer;

  gateway = new Gateway(manager, bank, {
    allowedOrigins: env.allowedOrigins,
    hostPin: env.hostPin,
    publicUrl: env.publicUrl,
  });
  gateway.attach(server);
  manager.start();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('shutting down', { signal });
    const force = setTimeout(() => process.exit(1), 8_000);
    force.unref();
    try {
      gateway?.close();
      server.close();
      await manager.stop();
      await store.close();
    } catch (e) {
      log.error('shutdown error', { error: (e as Error).message });
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => log.error('unhandled rejection', { reason: String(reason) }));
  // Never let one bad message or timer end the party: log it and stay up.
  process.on('uncaughtException', (e) => log.error('uncaught exception', { error: e.message, stack: e.stack }));
}

main().catch((e) => {
  log.error('fatal', { error: (e as Error).message, stack: (e as Error).stack });
  process.exit(1);
});
