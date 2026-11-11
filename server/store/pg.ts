/**
 * Postgres store (drizzle-orm over node-postgres). Rooms are upserted whole as
 * JSON snapshots; players and submissions are kept as proper rows so results
 * can be queried after the weekend.
 */
import { and, eq, gt, ne, sql, notInArray } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { RoomSnapshot } from '../room.js';
import { createPool, type Pool } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import * as schema from '../db/schema.js';
import { log } from '../log.js';
import type { Store, SubmissionRow } from './types.js';

export class PgStore implements Store {
  readonly kind = 'postgres' as const;
  private readonly pool: Pool;
  private readonly db: NodePgDatabase<typeof schema>;

  constructor(databaseUrl: string) {
    this.pool = createPool(databaseUrl);
    this.db = drizzle(this.pool, { schema });
  }

  async init(): Promise<void> {
    const applied = await runMigrations(this.pool);
    log.info('postgres ready', { migrationsApplied: applied });
  }

  async saveRoom(snapshot: RoomSnapshot): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(schema.rooms)
        .values({
          code: snapshot.code,
          createdAt: new Date(snapshot.createdAt),
          updatedAt: new Date(snapshot.updatedAt),
          status: snapshot.phase,
          config: snapshot.config,
          snapshot,
        })
        .onConflictDoUpdate({
          target: schema.rooms.code,
          set: {
            updatedAt: new Date(snapshot.updatedAt),
            status: snapshot.phase,
            config: snapshot.config,
            snapshot,
          },
        });

      if (snapshot.players.length) {
        await tx
          .insert(schema.players)
          .values(
            snapshot.players.map((p) => ({
              id: p.id,
              roomCode: snapshot.code,
              name: p.name,
              avatar: p.avatar,
              token: p.token,
              depth: p.depth,
              joinedAt: new Date(p.joinedAt),
            })),
          )
          .onConflictDoUpdate({
            target: schema.players.id,
            set: {
              name: sql`excluded.name`,
              avatar: sql`excluded.avatar`,
              depth: sql`excluded.depth`,
            },
          });
      }
      // Kicked players disappear from the snapshot; drop their rows too.
      const ids = snapshot.players.map((p) => p.id);
      if (ids.length) {
        await tx
          .delete(schema.players)
          .where(and(eq(schema.players.roomCode, snapshot.code), notInArray(schema.players.id, ids)));
      } else {
        await tx.delete(schema.players).where(eq(schema.players.roomCode, snapshot.code));
      }
    });
  }

  async saveSubmissions(roomCode: string, roundIndex: number, rows: SubmissionRow[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.submissions)
        .where(and(eq(schema.submissions.roomCode, roomCode), eq(schema.submissions.roundIndex, roundIndex)));
      if (!rows.length) return;
      await tx.insert(schema.submissions).values(
        rows.map((r) => ({
          roomCode: r.roomCode,
          roundIndex: r.roundIndex,
          promptId: r.promptId,
          playerId: r.playerId,
          raw: r.raw,
          key: r.key ?? null,
          tier: r.tier,
          points: r.points,
          createdAt: new Date(r.createdAt),
        })),
      );
    });
  }

  async deleteRoom(code: string): Promise<void> {
    await this.db.delete(schema.rooms).where(eq(schema.rooms.code, code));
  }

  async loadActiveRooms(sinceMs: number): Promise<RoomSnapshot[]> {
    const rows = await this.db
      .select({ snapshot: schema.rooms.snapshot })
      .from(schema.rooms)
      .where(and(gt(schema.rooms.updatedAt, new Date(sinceMs)), ne(schema.rooms.status, 'results')));
    return rows
      .map((r) => r.snapshot as RoomSnapshot)
      .filter((s) => s && s.v === 1 && typeof s.code === 'string');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
