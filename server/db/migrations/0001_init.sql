-- Separation Creek Krillion — initial schema
-- Applied by server/db/migrate.ts (idempotent; tracked in _migrations).

CREATE TABLE IF NOT EXISTS rooms (
  code        text PRIMARY KEY,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL,
  status      text NOT NULL,            -- lobby | prompt | reveal | results
  config      jsonb NOT NULL,           -- RoomConfig
  snapshot    jsonb NOT NULL            -- full RoomSnapshot, used to resume after a restart
);

CREATE INDEX IF NOT EXISTS rooms_updated_at_idx ON rooms (updated_at);

CREATE TABLE IF NOT EXISTS players (
  id          text PRIMARY KEY,
  room_code   text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name        text NOT NULL,
  avatar      text NOT NULL,
  token       text NOT NULL,
  depth       integer NOT NULL DEFAULT 0,
  joined_at   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS players_room_code_idx ON players (room_code);

CREATE TABLE IF NOT EXISTS submissions (
  id          serial PRIMARY KEY,
  room_code   text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  round_index integer NOT NULL,
  prompt_id   text NOT NULL,
  player_id   text NOT NULL,
  raw         text NOT NULL,
  key         text,
  tier        text NOT NULL,
  points      integer NOT NULL,
  created_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS submissions_room_round_idx ON submissions (room_code, round_index);
