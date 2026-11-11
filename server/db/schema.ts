/**
 * Drizzle schema — mirrors server/db/migrations/0001_init.sql. The SQL file is
 * the source of truth for the database; this file gives the store typed
 * queries.
 */
import { integer, jsonb, pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';

export const rooms = pgTable(
  'rooms',
  {
    code: text('code').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
    config: jsonb('config').notNull(),
    snapshot: jsonb('snapshot').notNull(),
  },
  (t) => [index('rooms_updated_at_idx').on(t.updatedAt)],
);

export const players = pgTable(
  'players',
  {
    id: text('id').primaryKey(),
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    avatar: text('avatar').notNull(),
    token: text('token').notNull(),
    depth: integer('depth').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('players_room_code_idx').on(t.roomCode)],
);

export const submissions = pgTable(
  'submissions',
  {
    id: serial('id').primaryKey(),
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    roundIndex: integer('round_index').notNull(),
    promptId: text('prompt_id').notNull(),
    playerId: text('player_id').notNull(),
    raw: text('raw').notNull(),
    key: text('key'),
    tier: text('tier').notNull(),
    points: integer('points').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('submissions_room_round_idx').on(t.roomCode, t.roundIndex)],
);
