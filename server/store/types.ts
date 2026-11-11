import type { TierId } from '../../shared/types.js';
import type { RoomSnapshot } from '../room.js';

export interface SubmissionRow {
  roomCode: string;
  roundIndex: number;
  promptId: string;
  playerId: string;
  raw: string;
  key?: string;
  tier: TierId;
  points: number;
  createdAt: number;
}

/**
 * Persistence boundary. The memory store makes the game work with zero
 * infrastructure; the Postgres store keeps every room, player and answer and
 * lets in-progress rooms survive a server restart.
 */
export interface Store {
  readonly kind: 'memory' | 'postgres';
  init(): Promise<void>;
  saveRoom(snapshot: RoomSnapshot): Promise<void>;
  /** Replaces the stored answers for one round (idempotent, re-run after moderation). */
  saveSubmissions(roomCode: string, roundIndex: number, rows: SubmissionRow[]): Promise<void>;
  deleteRoom(code: string): Promise<void>;
  /** Rooms updated after `sinceMs` that had not reached 'results'. */
  loadActiveRooms(sinceMs: number): Promise<RoomSnapshot[]>;
  close(): Promise<void>;
}
