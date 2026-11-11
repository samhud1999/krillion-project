/**
 * WebSocket gateway: the thin layer between sockets and Rooms.
 *
 * It upgrades /ws, validates every frame, maps a socket to an actor (host or
 * player of one room), forwards in-room messages to Room.handle, and pushes a
 * fresh view to every socket of a room whenever the manager says it changed.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { ServerMessage, ServerErrorCode } from '../shared/types.js';
import { PROTOCOL_VERSION } from '../shared/types.js';
import type { BankLike } from './bank.js';
import { log } from './log.js';
import { parseClientMessage, type ParsedClientMessage } from './protocol.js';
import type { Room, RoomEffect } from './room.js';
import type { RoomManager } from './rooms.js';
import { buildHostView, buildPlayerView } from './views.js';

const HEARTBEAT_MS = 25_000;
const RATE_WINDOW_MS = 1_000;
const RATE_MAX = 20;
/** close codes we send */
const CLOSE_REPLACED = 4001;
const CLOSE_KICKED = 4002;
const CLOSE_ROOM_GONE = 4000;

type ConnActor = { kind: 'host'; code: string } | { kind: 'player'; code: string; playerId: string };

interface Conn {
  ws: WebSocket;
  alive: boolean;
  actor?: ConnActor;
  /** scheme://host the socket connected through, for join URLs */
  baseUrl: string;
  stamps: number[];
  remote: string;
}

interface RoomConns {
  host?: Conn;
  players: Map<string, Conn>;
}

export interface GatewayOptions {
  allowedOrigins: string[];
  hostPin?: string;
  publicUrl?: string;
  now?: () => number;
}

/** Per-IP host-PIN failures: five wrong guesses lock that address out for a minute. */
const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 60_000;
const pinFailures = new Map<string, { fails: number; until: number }>();
/** Per-IP room creation: at most five new rooms per ten minutes. */
const CREATE_MAX = 5;
const CREATE_WINDOW_MS = 10 * 60_000;
const roomCreates = new Map<string, number[]>();

function pinMatches(given: string | undefined, expected: string): boolean {
  const a = createHash('sha256').update(given ?? '').digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export class Gateway {
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  private readonly conns = new Set<Conn>();
  private readonly byRoom = new Map<string, RoomConns>();
  private readonly hostBase = new Map<string, string>();
  private readonly now: () => number;
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly manager: RoomManager,
    private readonly bank: BankLike,
    private readonly opts: GatewayOptions,
  ) {
    this.now = opts.now ?? (() => Date.now());
    manager.on('change', (room, effects) => this.onRoomChange(room, effects));
    manager.on('evict', (room) => this.onRoomEvicted(room));
  }

  // --- lifecycle -----------------------------------------------------------

  attach(server: HttpServer): void {
    server.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket, head));
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.heartbeat = setInterval(() => {
      for (const c of this.conns) {
        if (!c.alive) {
          c.ws.terminate();
          continue;
        }
        c.alive = false;
        try {
          c.ws.ping();
        } catch {
          c.ws.terminate();
        }
      }
    }, HEARTBEAT_MS);
    this.heartbeat.unref?.();
  }

  close(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const c of this.conns) {
      try {
        c.ws.close(1001, 'server shutting down');
      } catch {
        /* ignore */
      }
    }
    this.wss.close();
  }

  connectionCount(): number {
    return this.conns.size;
  }

  // --- upgrade & origin ----------------------------------------------------

  private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (!this.originAllowed(req)) {
      log.warn('ws: rejected origin', { origin: req.headers.origin, host: req.headers.host });
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
  }

  private originAllowed(req: IncomingMessage): boolean {
    const origin = (req.headers.origin ?? '').toLowerCase().replace(/\/+$/, '');
    if (!origin) return true; // non-browser clients (bots, curl) send no Origin
    if (this.opts.allowedOrigins.includes(origin)) return true;
    if (this.opts.publicUrl && origin === this.opts.publicUrl.toLowerCase()) return true;
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return false;
    }
    const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '').toString().split(',')[0]!.trim().toLowerCase();
    return originHost === host;
  }

  private baseUrlFor(req: IncomingMessage): string {
    if (this.opts.publicUrl) return this.opts.publicUrl;
    const proto = (req.headers['x-forwarded-proto'] ?? '').toString().split(',')[0]!.trim() || 'http';
    const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost').toString().split(',')[0]!.trim();
    return `${proto}://${host}`;
  }

  // --- connection ----------------------------------------------------------

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const conn: Conn = {
      ws,
      alive: true,
      baseUrl: this.baseUrlFor(req),
      stamps: [],
      remote: (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').toString().split(',')[0]!.trim(),
    };
    this.conns.add(conn);
    ws.on('pong', () => (conn.alive = true));
    ws.on('message', (data) => this.onMessage(conn, data));
    ws.on('close', () => this.onClose(conn));
    ws.on('error', (e) => log.debug('ws: socket error', { error: e.message }));
    this.send(conn, { t: 'hello', protocol: PROTOCOL_VERSION, serverNow: this.now() });
  }

  private onClose(conn: Conn): void {
    this.conns.delete(conn);
    const actor = conn.actor;
    conn.actor = undefined;
    if (!actor) return;
    const rc = this.byRoom.get(actor.code);
    const room = this.manager.get(actor.code);
    const now = this.now();
    if (actor.kind === 'host') {
      if (rc?.host === conn) rc.host = undefined;
      if (room && rc?.host === undefined) room.setHostConnected(false, now);
    } else {
      if (rc?.players.get(actor.playerId) === conn) rc.players.delete(actor.playerId);
      if (room && !rc?.players.has(actor.playerId)) room.setPlayerConnected(actor.playerId, false, now);
    }
    if (room) this.manager.commit(room);
  }

  private onMessage(conn: Conn, data: RawData): void {
    const now = this.now();
    // Sliding-window rate limit: drop anything beyond RATE_MAX per second.
    conn.stamps = conn.stamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (conn.stamps.length >= RATE_MAX) return;
    conn.stamps.push(now);

    const parsed = parseClientMessage(data);
    if (!parsed.ok) {
      this.error(conn, 'bad_request', parsed.error);
      return;
    }
    try {
      this.dispatch(conn, parsed.msg, now);
    } catch (e) {
      log.error('ws: handler threw', { t: parsed.msg.t, error: (e as Error).message, stack: (e as Error).stack });
      this.error(conn, 'bad_request', 'Something went wrong handling that message');
    }
  }

  // --- dispatch ------------------------------------------------------------

  private dispatch(conn: Conn, msg: ParsedClientMessage, now: number): void {
    switch (msg.t) {
      case 'ping':
        this.send(conn, { t: 'pong', sentAt: msg.sentAt, serverNow: now });
        return;
      case 'host:create':
        return this.hostCreate(conn, msg, now);
      case 'host:resume':
        return this.hostResume(conn, msg.code, msg.hostToken, now);
      case 'player:join':
        return this.playerJoin(conn, msg.code, msg.name, msg.avatar, now);
      case 'player:resume':
        return this.playerResume(conn, msg.code, msg.token, now);
      default:
        break;
    }

    const actor = conn.actor;
    if (!actor) {
      this.error(conn, msg.t.startsWith('host:') ? 'not_host' : 'not_player', 'Join or create a room first');
      return;
    }
    const room = this.manager.get(actor.code);
    if (!room) {
      conn.actor = undefined;
      this.error(conn, 'room_not_found', 'That room has closed');
      return;
    }
    const result = room.handle(actor.kind === 'host' ? { kind: 'host' } : { kind: 'player', playerId: actor.playerId }, msg, now);
    if (!result.ok) this.error(conn, result.code, result.message);
    this.manager.commit(room);
  }

  private hostCreate(conn: Conn, msg: Extract<ParsedClientMessage, { t: 'host:create' }>, now: number): void {
    if (this.opts.hostPin) {
      const lock = pinFailures.get(conn.remote);
      if (lock && now < lock.until) {
        this.error(conn, 'pin_required', 'Too many wrong PINs — wait a minute and try again');
        return;
      }
      if (!pinMatches(msg.pin, this.opts.hostPin)) {
        const fails = (lock?.fails ?? 0) + 1;
        pinFailures.set(conn.remote, fails >= PIN_MAX_FAILS ? { fails: 0, until: now + PIN_LOCK_MS } : { fails, until: 0 });
        log.warn('wrong host pin', { remote: conn.remote, fails });
        this.error(conn, 'pin_required', msg.pin ? 'That host PIN is not right' : 'This server needs a host PIN to start a game');
        return;
      }
      pinFailures.delete(conn.remote);
    }
    const recent = (roomCreates.get(conn.remote) ?? []).filter((t) => now - t < CREATE_WINDOW_MS);
    if (recent.length >= CREATE_MAX) {
      this.error(conn, 'bad_request', 'That is a lot of rooms from one place — reuse one of them, or wait ten minutes');
      return;
    }
    let room: ReturnType<RoomManager['createRoom']>;
    try {
      room = this.manager.createRoom(msg.config);
    } catch (e) {
      this.error(conn, 'bad_request', (e as Error).message);
      return;
    }
    recent.push(now);
    roomCreates.set(conn.remote, recent);
    this.unbind(conn, now);
    this.bindHost(conn, room, now);
    this.send(conn, { t: 'host:created', code: room.code, hostToken: room.hostToken });
    this.manager.commit(room);
    log.info('host created room', { code: room.code, remote: conn.remote });
  }

  private hostResume(conn: Conn, code: string, hostToken: string, now: number): void {
    const room = this.manager.get(code);
    if (!room) return this.error(conn, 'room_not_found', `No room ${code}`);
    if (room.hostToken !== hostToken) return this.error(conn, 'not_host', 'That host link is not valid for this room');
    const alreadyHost = conn.actor?.kind === 'host' && conn.actor.code === room.code;
    if (!alreadyHost) {
      this.unbind(conn, now);
      this.bindHost(conn, room, now);
    }
    this.manager.commit(room);
    this.pushViews(room, [conn]);
  }

  private playerJoin(conn: Conn, code: string, name: string, avatar: Parameters<Room['join']>[1], now: number): void {
    const room = this.manager.get(code);
    if (!room) return this.error(conn, 'room_not_found', `No room called ${code} — check the code on the big screen`);
    const res = room.join(name, avatar, now);
    if (!res.ok) {
      this.manager.commit(room);
      return this.error(conn, res.code, res.message);
    }
    this.unbind(conn, now);
    this.bindPlayer(conn, room, res.value.playerId, now);
    this.send(conn, { t: 'player:joined', playerId: res.value.playerId, token: res.value.token, code: room.code });
    this.manager.commit(room);
    // commit() may have nothing new to broadcast (the join's version bump can
    // already have gone out while this socket was unbound), so push directly.
    this.pushViews(room, [conn]);
    log.info('player joined', { code: room.code, name, players: room.players.size });
  }

  private playerResume(conn: Conn, code: string, token: string, now: number): void {
    const room = this.manager.get(code);
    if (!room) return this.error(conn, 'room_not_found', `No room called ${code}`);
    const player = room.resume(token);
    if (!player) return this.error(conn, 'not_player', 'That player link is not valid any more');
    this.unbind(conn, now);
    this.bindPlayer(conn, room, player.id, now);
    this.send(conn, { t: 'player:joined', playerId: player.id, token: player.token, code: room.code });
    this.manager.commit(room);
    this.pushViews(room, [conn]);
  }

  // --- binding -------------------------------------------------------------

  private roomConns(code: string): RoomConns {
    let rc = this.byRoom.get(code);
    if (!rc) {
      rc = { players: new Map() };
      this.byRoom.set(code, rc);
    }
    return rc;
  }

  private bindHost(conn: Conn, room: Room, now: number): void {
    const rc = this.roomConns(room.code);
    if (rc.host && rc.host !== conn) {
      const old = rc.host;
      old.actor = undefined;
      this.conns.delete(old);
      old.ws.close(CLOSE_REPLACED, 'host opened elsewhere');
    }
    rc.host = conn;
    conn.actor = { kind: 'host', code: room.code };
    this.hostBase.set(room.code, conn.baseUrl);
    room.setHostConnected(true, now);
  }

  private bindPlayer(conn: Conn, room: Room, playerId: string, now: number): void {
    const rc = this.roomConns(room.code);
    const old = rc.players.get(playerId);
    if (old && old !== conn) {
      old.actor = undefined;
      this.conns.delete(old);
      old.ws.close(CLOSE_REPLACED, 'opened on another device');
    }
    rc.players.set(playerId, conn);
    conn.actor = { kind: 'player', code: room.code, playerId };
    room.setPlayerConnected(playerId, true, now);
  }

  /** Detaches a socket from whatever room it was in (it stays open). */
  private unbind(conn: Conn, now: number): void {
    const actor = conn.actor;
    if (!actor) return;
    conn.actor = undefined;
    const rc = this.byRoom.get(actor.code);
    const room = this.manager.get(actor.code);
    if (actor.kind === 'host') {
      if (rc?.host === conn) rc.host = undefined;
      room?.setHostConnected(false, now);
    } else {
      if (rc?.players.get(actor.playerId) === conn) rc.players.delete(actor.playerId);
      room?.setPlayerConnected(actor.playerId, false, now);
    }
    if (room) this.manager.commit(room);
  }

  // --- broadcast -----------------------------------------------------------

  private onRoomChange(room: Room, effects: RoomEffect[]): void {
    const rc = this.byRoom.get(room.code);
    for (const eff of effects) {
      if (eff.type !== 'kicked') continue;
      const conn = rc?.players.get(eff.playerId);
      if (conn) {
        rc?.players.delete(eff.playerId);
        conn.actor = undefined;
        this.send(conn, { t: 'kicked' });
        conn.ws.close(CLOSE_KICKED, 'removed by host');
      }
    }
    this.pushViews(room);
  }

  private onRoomEvicted(room: Room): void {
    const rc = this.byRoom.get(room.code);
    this.byRoom.delete(room.code);
    this.hostBase.delete(room.code);
    if (!rc) return;
    const all = [rc.host, ...rc.players.values()].filter((c): c is Conn => !!c);
    for (const c of all) {
      c.actor = undefined;
      c.ws.close(CLOSE_ROOM_GONE, 'room closed');
    }
  }

  private joinUrl(room: Room): string {
    const base = this.opts.publicUrl ?? this.hostBase.get(room.code) ?? 'http://localhost:8787';
    return `${base}/join/${room.code}`;
  }

  /** Sends fresh views to every socket of the room (or only to `only`). */
  private pushViews(room: Room, only?: Conn[]): void {
    const rc = this.byRoom.get(room.code);
    if (!rc) return;
    const now = this.now();
    const targets = only ?? [rc.host, ...rc.players.values()].filter((c): c is Conn => !!c);
    let hostJson: string | undefined;
    for (const conn of targets) {
      const actor = conn.actor;
      if (!actor || actor.code !== room.code) continue;
      if (actor.kind === 'host') {
        hostJson ??= JSON.stringify({
          t: 'state',
          view: buildHostView(room, this.bank.listSummaries(), this.joinUrl(room), now),
        } satisfies ServerMessage);
        this.sendRaw(conn, hostJson);
      } else {
        const view = buildPlayerView(room, actor.playerId, now);
        if (view) this.send(conn, { t: 'state', view });
      }
    }
  }

  // --- io ------------------------------------------------------------------

  private send(conn: Conn, msg: ServerMessage): void {
    this.sendRaw(conn, JSON.stringify(msg));
  }

  private sendRaw(conn: Conn, json: string): void {
    if (conn.ws.readyState !== WebSocket.OPEN) return;
    try {
      conn.ws.send(json);
    } catch (e) {
      log.debug('ws: send failed', { error: (e as Error).message });
    }
  }

  private error(conn: Conn, code: ServerErrorCode, message: string): void {
    this.send(conn, { t: 'error', code, message });
  }
}
