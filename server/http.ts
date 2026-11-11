/**
 * HTTP side: health, a couple of read-only JSON endpoints, and the built
 * client (dist/client) with SPA fallback when it exists.
 */
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { BankLike } from './bank.js';
import { log } from './log.js';
import type { RoomManager } from './rooms.js';

export interface AppDeps {
  manager: RoomManager;
  bank: BankLike;
  clientDir: string;
  startedAt: number;
  connectionCount: () => number;
}

/** Per-IP ceiling on the JSON endpoints, so room codes cannot be enumerated at speed. */
const API_MAX = 60;
const API_WINDOW_MS = 10_000;

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use(secureHeaders());

  const apiStamps = new Map<string, number[]>();
  app.use('/api/*', async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || getConnInfo(c).remote.address || 'unknown';
    const now = Date.now();
    const stamps = (apiStamps.get(ip) ?? []).filter((t) => now - t < API_WINDOW_MS);
    if (stamps.length >= API_MAX) return c.json({ error: 'slow down' }, 429);
    stamps.push(now);
    apiStamps.set(ip, stamps);
    if (apiStamps.size > 10_000) apiStamps.clear();
    await next();
  });

  app.get('/healthz', (c) => {
    const s = deps.manager.stats();
    return c.json({
      ok: true,
      rooms: s.rooms,
      players: s.players,
      connections: deps.connectionCount(),
      uptime: Math.round((Date.now() - deps.startedAt) / 1000),
    });
  });

  // Host notes carry the closest-to-the-pin answers and the traps, so they only
  // travel inside the host's own view, never on this public endpoint.
  app.get('/api/prompts', (c) => c.json(deps.bank.listSummaries().map(({ hostNotes: _hidden, ...p }) => p)));

  app.get('/api/rooms/:code', (c) => {
    const room = deps.manager.get(c.req.param('code'));
    if (!room) return c.json({ exists: false }, 404);
    const players = [...room.players.values()];
    return c.json({
      exists: true,
      phase: room.phase,
      players: players.length,
      takenAvatars: [...new Set(players.map((p) => p.avatar))],
      title: room.config.title ?? null,
    });
  });

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  if (existsSync(deps.clientDir)) {
    // serveStatic joins `root` with the request path; a path relative to cwd keeps it portable.
    const root = relative(process.cwd(), deps.clientDir) || '.';
    const immutable = (c: { header: (k: string, v: string) => void }) =>
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    const noCache = (c: { header: (k: string, v: string) => void }) => c.header('Cache-Control', 'no-cache');

    app.use('/assets/*', serveStatic({ root, onFound: (_p, c) => immutable(c) }));
    app.use('*', serveStatic({ root, onFound: (p, c) => (p.endsWith('index.html') ? noCache(c) : c.header('Cache-Control', 'public, max-age=3600')) }));
    app.get('*', serveStatic({ root, path: 'index.html', onFound: (_p, c) => noCache(c) }));
    log.info('serving client', { dir: deps.clientDir });
  } else {
    app.get('/', (c) =>
      c.text(
        'Separation Creek Krillion server is running.\n' +
          'The client has not been built: run `npm run build` (production) or `npm run dev` (development, http://localhost:5173).\n',
      ),
    );
    log.warn('client build not found — API and WebSocket only', { dir: deps.clientDir });
  }

  app.onError((err, c) => {
    log.error('http: unhandled error', { path: c.req.path, error: err.message });
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
