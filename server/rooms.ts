/**
 * RoomManager — owns every live Room, arms the one real timer each room
 * needs, persists snapshots, evicts idle rooms and tells the gateway when
 * something changed. The Room itself stays free of I/O (see room.ts).
 */
import type { RoomConfig } from '../shared/types.js';
import { LIMITS } from '../shared/types.js';
import type { BankLike } from './bank.js';
import { log } from './log.js';
import { Room, randomRoomCode, type RoomEffect } from './room.js';
import type { Store, SubmissionRow } from './store/types.js';

export { Room } from './room.js';
export type { Actor, RoomResult, RoomSnapshot } from './room.js';

export const FINISHED_EVICT_MS = 2 * 60 * 60 * 1000;
export const RESTORE_WINDOW_MS = 12 * 60 * 60 * 1000;
/** A lobby nobody is connected to is forgotten after this long. */
export const LOBBY_IDLE_EVICT_MS = 10 * 60 * 1000;
/** Hard ceiling on simultaneous rooms; one party needs one. */
export const MAX_LIVE_ROOMS = 50;
const PERSIST_DEBOUNCE_MS = 250;
const SWEEP_INTERVAL_MS = 60 * 1000;

export interface ManagerListeners {
  /** state changed → gateway rebroadcasts views */
  change: (room: Room, effects: RoomEffect[]) => void;
  /** room is gone → gateway closes its sockets */
  evict: (room: Room) => void;
}

export interface ManagerOptions {
  bank: BankLike;
  store: Store;
  now?: () => number;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly bank: BankLike;
  private readonly store: Store;
  private readonly now: () => number;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly persistTimers = new Map<string, NodeJS.Timeout>();
  private readonly lastBroadcast = new Map<string, number>();
  private readonly listeners: { change: ManagerListeners['change'][]; evict: ManagerListeners['evict'][] } = {
    change: [],
    evict: [],
  };
  private sweepTimer?: NodeJS.Timeout;
  private pendingWrites = new Set<Promise<unknown>>();

  constructor(opts: ManagerOptions) {
    this.bank = opts.bank;
    this.store = opts.store;
    this.now = opts.now ?? (() => Date.now());
  }

  on<K extends keyof ManagerListeners>(event: K, fn: ManagerListeners[K]): void {
    (this.listeners[event] as ManagerListeners[K][]).push(fn);
  }

  // --- lifecycle -----------------------------------------------------------

  start(): void {
    this.sweepTimer = setInterval(() => this.sweep(this.now()), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const [code, t] of this.persistTimers) {
      clearTimeout(t);
      const room = this.rooms.get(code);
      if (room) this.persistNow(room);
    }
    this.persistTimers.clear();
    await Promise.allSettled([...this.pendingWrites]);
  }

  /** Reloads rooms that were live before a restart (no-op for the memory store). */
  async restore(): Promise<number> {
    const now = this.now();
    let count = 0;
    try {
      const snaps = await this.store.loadActiveRooms(now - RESTORE_WINDOW_MS);
      for (const snap of snaps) {
        if (this.rooms.has(snap.code)) continue;
        try {
          const room = Room.fromSnapshot(snap, this.bank, now);
          this.rooms.set(room.code, room);
          this.arm(room);
          count += 1;
        } catch (e) {
          log.warn('restore: skipping unreadable snapshot', { code: snap.code, error: (e as Error).message });
        }
      }
    } catch (e) {
      log.error('restore: failed to load rooms', { error: (e as Error).message });
    }
    if (count) log.info('restore: rooms resumed', { count });
    return count;
  }

  // --- rooms ---------------------------------------------------------------

  createRoom(config?: Partial<RoomConfig>): Room {
    if (this.rooms.size >= MAX_LIVE_ROOMS) {
      throw new Error(`This server already has ${MAX_LIVE_ROOMS} rooms open — try again in a few minutes`);
    }
    let code = randomRoomCode();
    for (let i = 0; i < 100 && this.rooms.has(code); i++) code = randomRoomCode();
    if (this.rooms.has(code)) throw new Error('could not allocate a room code');
    const room = new Room({ code, bank: this.bank, now: this.now(), config });
    this.rooms.set(code, room);
    log.info('room created', { code, prompts: room.config.promptIds.length });
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  stats(): { rooms: number; players: number } {
    let players = 0;
    for (const r of this.rooms.values()) players += r.players.size;
    return { rooms: this.rooms.size, players };
  }

  /** Call after any mutation (or attempted mutation) of a room. */
  commit(room: Room): void {
    this.arm(room);
    const effects = room.drainEffects();
    const last = this.lastBroadcast.get(room.code) ?? -1;
    if (room.version === last && effects.length === 0) return;
    this.lastBroadcast.set(room.code, room.version);
    this.schedulePersist(room);
    for (const fn of this.listeners.change) fn(room, effects);
  }

  evict(room: Room, reason: string): void {
    if (!this.rooms.delete(room.code)) return;
    const t = this.timers.get(room.code);
    if (t) clearTimeout(t);
    this.timers.delete(room.code);
    const pt = this.persistTimers.get(room.code);
    if (pt) clearTimeout(pt);
    this.persistTimers.delete(room.code);
    this.lastBroadcast.delete(room.code);
    if (room.phase === 'lobby' || this.store.kind === 'memory') {
      // Nothing to keep (an empty lobby, or a store that cannot outlive the
      // process anyway): forget it rather than restoring a zombie later.
      void this.store
        .deleteRoom(room.code)
        .catch((e: unknown) => log.warn('delete room failed', { code: room.code, error: (e as Error).message }));
    } else {
      this.persistNow(room);
    }
    log.info('room evicted', { code: room.code, reason, phase: room.phase });
    for (const fn of this.listeners.evict) fn(room);
  }

  /** Evicts rooms nobody is connected to any more, and finished rooms left idle. */
  sweep(now: number): void {
    for (const room of [...this.rooms.values()]) {
      const idle = now - room.updatedAt;
      if (room.hasConnections()) continue;
      if (idle > LIMITS.roomIdleEvictMs) this.evict(room, 'idle');
      else if (room.phase === 'results' && idle > FINISHED_EVICT_MS) this.evict(room, 'finished');
      else if (room.phase === 'lobby' && idle > LOBBY_IDLE_EVICT_MS) this.evict(room, 'empty lobby');
    }
  }

  // --- timers --------------------------------------------------------------

  private arm(room: Room): void {
    const existing = this.timers.get(room.code);
    if (existing) clearTimeout(existing);
    this.timers.delete(room.code);
    const deadline = room.nextDeadline();
    if (deadline === null) return;
    const delay = Math.max(1, deadline - this.now());
    const t = setTimeout(() => {
      this.timers.delete(room.code);
      if (!this.rooms.has(room.code)) return;
      // A throw inside a timer would take the whole process (and every room)
      // down with it; log it and keep the night going.
      try {
        room.tick(this.now());
        this.commit(room);
      } catch (e) {
        log.error('room timer failed', { code: room.code, error: (e as Error).message, stack: (e as Error).stack });
      }
    }, delay);
    this.timers.set(room.code, t);
  }

  // --- persistence ---------------------------------------------------------

  private schedulePersist(room: Room): void {
    if (this.persistTimers.has(room.code)) return;
    const t = setTimeout(() => {
      this.persistTimers.delete(room.code);
      if (this.rooms.has(room.code)) this.persistNow(room);
    }, PERSIST_DEBOUNCE_MS);
    t.unref?.();
    this.persistTimers.set(room.code, t);
  }

  private persistNow(room: Room): void {
    const snap = room.snapshot();
    const writes: Promise<unknown>[] = [this.store.saveRoom(snap)];
    const round = room.currentRound;
    if (round?.closed && round.results) {
      const rows: SubmissionRow[] = Object.values(round.results).map((r) => ({
        roomCode: room.code,
        roundIndex: round.index,
        promptId: round.promptId,
        playerId: r.playerId,
        raw: r.raw,
        key: r.key,
        tier: r.tier,
        points: r.points,
        createdAt: round.endsAt,
      }));
      writes.push(this.store.saveSubmissions(room.code, round.index, rows));
    }
    for (const w of writes) {
      const tracked = w.catch((e: unknown) => log.error('persist failed', { code: room.code, error: (e as Error).message }));
      this.pendingWrites.add(tracked);
      void tracked.finally(() => this.pendingWrites.delete(tracked));
    }
  }
}
