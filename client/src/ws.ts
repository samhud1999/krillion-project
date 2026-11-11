/**
 * WebSocket connection manager + tiny external store.
 *
 * - connects to ws(s)://<host>/ws, reconnects with exponential backoff + jitter
 * - resumes the saved session (player or host) on every (re)connect
 * - queues outbound messages while offline (stale answers are dropped)
 * - keeps a server clock offset from hello / pong / state.serverNow
 * - exposes `useStore()` for React via useSyncExternalStore
 */
import { useSyncExternalStore } from 'react';
import type { AvatarId, ClientMessage, RoomConfig, ServerErrorCode, ServerMessage, View } from '@shared/types';
import { PROTOCOL_VERSION } from '@shared/types';
import { clearSession, loadSession, saveSession, type Session } from './session';

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ServerError {
  code: ServerErrorCode;
  message: string;
  at: number;
  seq: number;
}

export interface StoreState {
  status: ConnStatus;
  everOpened: boolean;
  view: View | null;
  lastError: ServerError | null;
  session: Session | null;
  /** a one-line message for the Join screen, e.g. the room went away */
  notice: string | null;
  kicked: boolean;
  rttMs: number | null;
  protocolMismatch: boolean;
}

let state: StoreState = {
  status: 'connecting',
  everOpened: false,
  view: null,
  lastError: null,
  session: loadSession(),
  notice: null,
  kicked: false,
  rttMs: null,
  protocolMismatch: false,
};

const listeners = new Set<() => void>();
const msgListeners = new Set<(m: ServerMessage) => void>();

function set(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getState(): StoreState {
  return state;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function onMessage(l: (m: ServerMessage) => void): () => void {
  msgListeners.add(l);
  return () => {
    msgListeners.delete(l);
  };
}

// ---------------------------------------------------------------------------
// clock
// ---------------------------------------------------------------------------

let offset = 0;
let offsetSource: 'none' | 'state' | 'pong' = 'none';
/** lowest round trip seen lately; pongs much slower than this (a suspended tab waking up) are not trusted for the clock */
let bestRtt = Infinity;
const MAX_TRUSTED_RTT_MS = 1000;

/** Best estimate of the server's Date.now(). */
export function serverNow(): number {
  return Date.now() + offset;
}

// ---------------------------------------------------------------------------
// socket lifecycle
// ---------------------------------------------------------------------------

/** server closes a socket with these when it was superseded or the player was removed */
const CLOSE_REPLACED = 4001;
const CLOSE_KICKED = 4002;

let socket: WebSocket | null = null;
/** true after a deliberate server close; automatic reconnects stop until the user acts */
let halted = false;
let attempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
/** pings sent since the last pong; two in a row unanswered means the socket is half-open */
let unansweredPings = 0;
let started = false;
let errSeq = 0;
let queue: { msg: ClientMessage; at: number }[] = [];
let pendingJoin: { code: string; name: string; avatar: AvatarId } | null = null;

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

declare global {
  interface Window {
    /** Debug hook: `__sck.mock(view)` renders any View without a server (screenshots, design work). */
    __sck?: { mock: (view: View | null) => void; send: (m: ClientMessage) => void; state: () => StoreState };
  }
}

export function start(): void {
  if (started) return;
  started = true;
  window.__sck = {
    mock: (view) => set({ view, status: view ? 'open' : state.status, everOpened: true }),
    send,
    state: getState,
  };
  connect();
  window.addEventListener('online', () => {
    if (!isLive() && !halted) connect();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (isLive()) {
      // the clock may have drifted while the tab slept: measure straight away
      raw({ t: 'ping', sentAt: Date.now() });
      return;
    }
    // A seat deliberately taken by another device stays halted until the
    // person taps "Use this device" — otherwise two phones would steal it back
    // and forth on every screen unlock.
    if (!halted) connect();
  });
}

/** Reconnect now (used after a deliberate close, e.g. "take the seat back"). */
export function reconnect(): void {
  halted = false;
  connect();
}

function isLive(): boolean {
  return !!socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN);
}

function connect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (isLive()) return;
  set({ status: state.everOpened ? 'reconnecting' : 'connecting' });

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    if (socket !== ws) return;
    attempts = 0;
    unansweredPings = 0;
    set({ status: 'open', everOpened: true });
    const s = state.session;
    if (s) {
      if (s.role === 'player') raw({ t: 'player:resume', code: s.code, token: s.token });
      else raw({ t: 'host:resume', code: s.code, hostToken: s.hostToken });
    }
    flush();
    startPing();
  };

  ws.onmessage = (ev: MessageEvent<string>) => {
    let m: ServerMessage;
    try {
      m = JSON.parse(ev.data) as ServerMessage;
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') return;
    handle(m);
  };

  ws.onclose = (ev: CloseEvent) => {
    if (socket !== ws) return;
    socket = null;
    stopPing();
    if (ev.code === CLOSE_REPLACED) {
      // another tab or device resumed this seat; don't fight it. Coming back to
      // this tab (visibilitychange) or acting here takes the seat back.
      halted = true;
      set({ status: 'closed', notice: 'This game is open in another tab or on another device.' });
      return;
    }
    if (ev.code === CLOSE_KICKED) {
      halted = true;
      clearSession();
      set({ status: 'closed', session: null, view: null, kicked: true, notice: 'The host removed you from the game.' });
      return;
    }
    set({ status: state.everOpened ? 'reconnecting' : 'connecting' });
    scheduleReconnect();
  };

  ws.onerror = () => {
    /* onclose follows */
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = Math.min(8000, 500 * 2 ** attempts) + Math.random() * 300;
  attempts = Math.min(attempts + 1, 6);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function startPing(): void {
  stopPing();
  pingTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (unansweredPings >= 2) {
      // Half-open socket (Wi-Fi dropped without a FIN): close it so the
      // normal reconnect path takes over instead of waiting for the OS.
      unansweredPings = 0;
      socket.close();
      return;
    }
    unansweredPings += 1;
    raw({ t: 'ping', sentAt: Date.now() });
  }, 10_000);
}

function stopPing(): void {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}

function raw(msg: ClientMessage): boolean {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

/** Send now, or queue until the socket reopens (pings are never queued). */
export function send(msg: ClientMessage): void {
  if (raw(msg)) return;
  if (msg.t === 'ping') return;
  queue.push({ msg, at: Date.now() });
  if (!isLive()) {
    halted = false;
    connect();
  }
}

/** Drop queued (not yet sent) messages matching `pred`, e.g. an answer the player is retracting. */
export function cancelQueued(pred: (msg: ClientMessage) => boolean): void {
  queue = queue.filter((q) => !pred(q.msg));
}

function flush(): void {
  const q = queue;
  queue = [];
  const now = Date.now();
  for (const { msg, at } of q) {
    // an answer older than the longest possible prompt is certainly too late
    if (msg.t === 'player:answer' && now - at > 60_000) continue;
    raw(msg);
  }
}

// ---------------------------------------------------------------------------
// inbound
// ---------------------------------------------------------------------------

function handle(m: ServerMessage): void {
  switch (m.t) {
    case 'hello': {
      if (offsetSource === 'none') {
        offset = m.serverNow - Date.now();
        offsetSource = 'state';
      }
      if (m.protocol !== PROTOCOL_VERSION) set({ protocolMismatch: true });
      break;
    }
    case 'pong': {
      const now = Date.now();
      const rtt = Math.max(0, now - m.sentAt);
      unansweredPings = 0;
      set({ rttMs: rtt });
      // A pong that took seconds (tab suspended between send and receive, a
      // main-thread stall) says nothing reliable about the clock; keep the
      // offset from a quick sample instead.
      if (rtt > MAX_TRUSTED_RTT_MS) break;
      if (offsetSource !== 'pong' || rtt <= bestRtt + 300) {
        offset = m.serverNow - (m.sentAt + rtt / 2);
        offsetSource = 'pong';
      }
      bestRtt = Math.min(rtt, bestRtt + 50); // decays upward so one lucky sample never pins it forever
      break;
    }
    case 'state': {
      const v = m.view;
      if (!v || typeof v !== 'object') break;
      if (offsetSource !== 'pong' && typeof v.serverNow === 'number') offset = v.serverNow - Date.now();
      const cur = state.view;
      if (cur && cur.code === v.code && cur.role === v.role && typeof v.version === 'number' && v.version < cur.version) {
        break; // stale frame
      }
      let session = state.session;
      if (v.role === 'player' && session?.role === 'player' && session.playerId === v.me?.id) {
        const p = v.players?.find((x) => x.id === v.me.id);
        if (p && (p.name !== session.name || p.avatar !== session.avatar)) {
          session = { ...session, name: p.name, avatar: p.avatar };
          saveSession(session);
        }
      }
      set({ view: v, session, kicked: false });
      break;
    }
    case 'host:created': {
      const s: Session = { role: 'host', code: m.code, hostToken: m.hostToken };
      saveSession(s);
      const keepView = state.view && state.view.role === 'host' && state.view.code === m.code ? state.view : null;
      set({ session: s, notice: null, kicked: false, view: keepView });
      break;
    }
    case 'player:joined': {
      // sent both for a fresh join and as the ack of player:resume (then a state frame follows)
      const pj = pendingJoin;
      pendingJoin = null;
      const prev = state.session;
      const resumed = prev?.role === 'player' && prev.playerId === m.playerId ? prev : null;
      const s: Session = {
        role: 'player',
        code: m.code,
        playerId: m.playerId,
        token: m.token,
        name: pj?.name ?? resumed?.name ?? '',
        avatar: pj?.avatar ?? resumed?.avatar ?? 'koala',
      };
      saveSession(s);
      const keepView = state.view && state.view.role === 'player' && state.view.code === m.code ? state.view : null;
      set({ session: s, notice: null, kicked: false, view: keepView });
      break;
    }
    case 'kicked': {
      clearSession();
      set({ session: null, view: null, kicked: true, notice: 'The host removed you from the game.' });
      break;
    }
    case 'error': {
      const err: ServerError = { code: m.code, message: m.message ?? '', at: Date.now(), seq: ++errSeq };
      const s = state.session;
      const lostSeat =
        !!s &&
        (m.code === 'room_not_found' ||
          (m.code === 'not_player' && s.role === 'player') ||
          (m.code === 'not_host' && s.role === 'host'));
      if (lostSeat) {
        clearSession();
        // the notice on the Join screen explains this; no toast on top of it
        set({
          session: null,
          view: null,
          notice:
            m.code === 'room_not_found'
              ? 'That room has finished or does not exist any more.'
              : m.code === 'not_host'
                ? 'Your host link for that room no longer works. Create a new room.'
                : 'Your seat in that room has gone. Join again.',
        });
      } else {
        set({ lastError: err });
      }
      break;
    }
    default:
      break;
  }
  msgListeners.forEach((l) => l(m));
}

// ---------------------------------------------------------------------------
// high-level actions
// ---------------------------------------------------------------------------

export function joinRoom(code: string, name: string, avatar: AvatarId): void {
  pendingJoin = { code, name, avatar };
  send({ t: 'player:join', code, name, avatar });
}

/** `pin` is only needed when the server is started with HOST_PIN set. */
export function createRoom(config?: Partial<RoomConfig>, pin?: string): void {
  const msg: ClientMessage = pin ? { t: 'host:create', config, pin } : { t: 'host:create', config };
  send(msg);
}

export function leaveSession(): void {
  clearSession();
  pendingJoin = null;
  queue = [];
  // Close the socket too, otherwise the server keeps this connection bound to
  // the old seat (name reserved, still "connected") and a fresh join from the
  // same page never gets its first state frame. The reconnect path opens a
  // clean, unbound socket.
  const ws = socket;
  socket = null;
  stopPing();
  halted = false;
  try {
    ws?.close(1000);
  } catch {
    /* already closed */
  }
  set({ session: null, view: null, kicked: false, notice: null, status: 'reconnecting' });
  connect();
}

export function dismissNotice(): void {
  set({ notice: null, kicked: false });
}

/**
 * Resolve with the first message whose type is in `types`, or with the first
 * error. Rejects after `timeoutMs`.
 */
export function waitFor<T extends ServerMessage['t']>(
  types: readonly T[],
  timeoutMs = 8000,
): Promise<Extract<ServerMessage, { t: T }> | Extract<ServerMessage, { t: 'error' }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error('timeout'));
    }, timeoutMs);
    const off = onMessage((m) => {
      if (m.t === 'error' || (types as readonly string[]).includes(m.t)) {
        clearTimeout(timer);
        off();
        resolve(m as Extract<ServerMessage, { t: T }> | Extract<ServerMessage, { t: 'error' }>);
      }
    });
  });
}

/** Plain-English copy for server error codes. */
export function describeError(code: ServerErrorCode, fallback?: string): string {
  switch (code) {
    case 'room_not_found':
      return 'No room with that code. Check the letters on the host screen.';
    case 'room_full':
      return 'That room is full.';
    case 'name_taken':
      return "That name's taken — try another.";
    case 'avatar_taken':
      return 'Someone already picked that animal.';
    case 'game_in_progress':
      return 'The game has already started — ask the host to restart or wait for the next one.';
    case 'too_late':
      return 'Too late — that prompt has closed.';
    case 'already_answered':
      return "You've already locked in.";
    case 'wrong_phase':
      return 'Hang on — the game is not at that step.';
    case 'not_host':
      return 'Only the host can do that.';
    case 'not_player':
      return "You're not in this room any more.";
    case 'pin_required':
      return 'This server needs a host PIN to start a game.';
    case 'protocol_mismatch':
      return 'This page is out of date — refresh to get the latest version.';
    case 'bad_request':
    default:
      return fallback && fallback.length < 140 ? fallback : 'Something went wrong. Try again.';
  }
}
