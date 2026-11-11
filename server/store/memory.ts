import type { RoomSnapshot } from '../room.js';
import type { Store, SubmissionRow } from './types.js';

/** Keeps snapshots in process memory. Nothing survives a restart — by design. */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  readonly rooms = new Map<string, RoomSnapshot>();
  readonly submissions = new Map<string, SubmissionRow[]>();

  async init(): Promise<void> {}

  async saveRoom(snapshot: RoomSnapshot): Promise<void> {
    this.rooms.set(snapshot.code, snapshot);
  }

  async saveSubmissions(roomCode: string, roundIndex: number, rows: SubmissionRow[]): Promise<void> {
    this.submissions.set(`${roomCode}:${roundIndex}`, rows);
  }

  async deleteRoom(code: string): Promise<void> {
    this.rooms.delete(code);
    for (const k of [...this.submissions.keys()]) if (k.startsWith(`${code}:`)) this.submissions.delete(k);
  }

  async loadActiveRooms(): Promise<RoomSnapshot[]> {
    // The manager already holds every live room; there is nothing to restore.
    return [];
  }

  async close(): Promise<void> {}
}
