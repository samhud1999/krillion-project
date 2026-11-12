/**
 * Room — the authoritative state machine for one game.
 *
 * No sockets, no timers, no Date.now() in here: every method takes `now`, and
 * the manager asks `nextDeadline()` to know when to call `tick(now)`. That
 * keeps a full 7-round game testable in a few milliseconds.
 */
import { randomUUID } from 'node:crypto';
import type {
  AnswerGroup,
  AvatarId,
  NumericAnswer,
  RoomConfig,
  RoomPhase,
  RoundResultEntry,
  ServerErrorCode,
  TierId,
} from '../shared/types.js';
import { LIMITS, MAX_ROUNDS } from '../shared/types.js';
import { AVATAR_IDS, DEFAULT_SPECIAL_ANSWERS } from '../shared/theme.js';
import { parseNumber, scoreNumericRound, scoreOpenRound } from '../shared/scoring.js';
import type { BankLike } from './bank.js';
import type { ParsedClientMessage } from './protocol.js';

/** Extra time we accept an answer after `endsAt`, to absorb network latency. */
export const ANSWER_ALLOWANCE_MS = 300;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Actor = { kind: 'host' } | { kind: 'player'; playerId: string };

export type RoomError = { ok: false; code: ServerErrorCode; message: string };
export type RoomOk<T> = { ok: true; value: T };
export type RoomResult<T = null> = RoomOk<T> | RoomError;

export type RoomEffect = { type: 'kicked'; playerId: string } | { type: 'round_closed'; roundIndex: number };

export interface PlayerRecord {
  id: string;
  token: string;
  name: string;
  avatar: AvatarId;
  connected: boolean;
  depth: number;
  lastTier?: TierId;
  lastPoints?: number;
  joinedAt: number;
}

export interface SubmissionRecord {
  raw: string;
  at: number;
}

export interface RoundRecord {
  index: number;
  promptId: string;
  startedAt: number;
  endsAt: number;
  /** early-close deadline once everyone connected has answered */
  closeAt?: number;
  closed: boolean;
  submissions: Map<string, SubmissionRecord>;
  /** depth of every player when the round started (moderation re-scores from here) */
  depthBefore: Record<string, number>;
  rejectedKeys: Set<string>;
  /** unverified groups the host has vouched for (lifts a lone unknown answer to a deep cut) */
  acceptedKeys: Set<string>;
  groups?: AnswerGroup[];
  results?: Record<string, RoundResultEntry>;
  validCount?: number;
  numericAnswer?: NumericAnswer;
}

/** JSON-safe copy of a room, for persistence and restarts. */
export interface RoomSnapshot {
  v: 1;
  code: string;
  hostToken: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  version: number;
  phase: RoomPhase;
  config: RoomConfig;
  players: PlayerRecord[];
  rounds: Array<
    Omit<RoundRecord, 'submissions' | 'rejectedKeys' | 'acceptedKeys'> & {
      submissions: Array<[string, SubmissionRecord]>;
      rejectedKeys: string[];
      /** absent in snapshots written before vouching existed */
      acceptedKeys?: string[];
    }
  >;
}

const err = (code: ServerErrorCode, message: string): RoomError => ({ ok: false, code, message });
const ok = <T>(value: T): RoomOk<T> => ({ ok: true, value });

/**
 * Trims, collapses whitespace and strips control and zero-width characters,
 * which render as blank names on the TV and make Postgres reject the row.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/[\p{Cc}​-‍⁠﻿]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

export function validateConfigPatch(patch: Partial<RoomConfig>, bank: BankLike): RoomResult<Partial<RoomConfig>> {
  const out: Partial<RoomConfig> = {};

  if (patch.promptIds !== undefined) {
    if (!Array.isArray(patch.promptIds) || patch.promptIds.length === 0) {
      return err('bad_request', 'Pick at least one prompt');
    }
    if (patch.promptIds.length > MAX_ROUNDS) return err('bad_request', `At most ${MAX_ROUNDS} prompts`);
    const seen = new Set<string>();
    for (const id of patch.promptIds) {
      if (typeof id !== 'string' || !bank.has(id)) return err('bad_request', `Unknown prompt "${String(id)}"`);
      if (seen.has(id)) return err('bad_request', `Prompt "${id}" is listed twice`);
      seen.add(id);
    }
    out.promptIds = [...patch.promptIds];
  }

  if (patch.secondsPerPrompt !== undefined) {
    const s = patch.secondsPerPrompt;
    if (!Number.isInteger(s) || s < LIMITS.minSecondsPerPrompt || s > LIMITS.maxSecondsPerPrompt) {
      return err('bad_request', `Timer must be ${LIMITS.minSecondsPerPrompt}–${LIMITS.maxSecondsPerPrompt} seconds`);
    }
    out.secondsPerPrompt = s;
  }

  if (patch.endEarlyWhenAllAnswered !== undefined) {
    if (typeof patch.endEarlyWhenAllAnswered !== 'boolean') return err('bad_request', 'endEarlyWhenAllAnswered must be a boolean');
    out.endEarlyWhenAllAnswered = patch.endEarlyWhenAllAnswered;
  }

  if (patch.specialAnswers !== undefined) {
    if (typeof patch.specialAnswers !== 'object' || patch.specialAnswers === null || Array.isArray(patch.specialAnswers)) {
      return err('bad_request', 'specialAnswers must be an object');
    }
    const cleaned: Record<string, string[]> = {};
    for (const [promptId, list] of Object.entries(patch.specialAnswers)) {
      if (!Array.isArray(list)) return err('bad_request', `specialAnswers.${promptId} must be a list`);
      if (list.length > 20) return err('bad_request', 'At most 20 special answers per prompt');
      const strings: string[] = [];
      for (const s of list) {
        if (typeof s !== 'string') return err('bad_request', 'Special answers must be text');
        const t = s.trim().slice(0, LIMITS.maxAnswerLength);
        if (t) strings.push(t);
      }
      if (strings.length) cleaned[promptId] = strings;
    }
    out.specialAnswers = cleaned;
  }

  if (patch.title !== undefined) {
    if (typeof patch.title !== 'string') return err('bad_request', 'title must be text');
    const t = patch.title.trim().slice(0, 40);
    out.title = t || undefined;
  }

  return ok(out);
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

export interface RoomInit {
  code: string;
  bank: BankLike;
  now: number;
  hostToken?: string;
  config?: Partial<RoomConfig>;
}

export class Room {
  readonly code: string;
  readonly hostToken: string;
  readonly createdAt: number;
  readonly bank: BankLike;

  phase: RoomPhase = 'lobby';
  config: RoomConfig;
  readonly players = new Map<string, PlayerRecord>();
  rounds: RoundRecord[] = [];
  hostConnected = false;
  version = 0;
  updatedAt: number;
  finishedAt?: number;

  private effects: RoomEffect[] = [];

  constructor(init: RoomInit) {
    this.code = init.code.toUpperCase();
    this.hostToken = init.hostToken ?? randomUUID();
    this.createdAt = init.now;
    this.updatedAt = init.now;
    this.bank = init.bank;
    this.config = defaultConfig(init.bank);
    if (init.config) {
      // Apply each field on its own, so one bad value (an unknown prompt id,
      // say) does not silently discard the host's other settings.
      for (const [key, value] of Object.entries(init.config)) {
        const v = validateConfigPatch({ [key]: value } as Partial<RoomConfig>, init.bank);
        if (v.ok) Object.assign(this.config, v.value);
      }
    }
  }

  // --- derived -------------------------------------------------------------

  get currentRound(): RoundRecord | undefined {
    return this.rounds.length ? this.rounds[this.rounds.length - 1] : undefined;
  }

  get roundCount(): number {
    return this.config.promptIds.length;
  }

  /** Any socket (host or player) currently attached? */
  hasConnections(): boolean {
    if (this.hostConnected) return true;
    for (const p of this.players.values()) if (p.connected) return true;
    return false;
  }

  drainEffects(): RoomEffect[] {
    const out = this.effects;
    this.effects = [];
    return out;
  }

  private bump(now: number): void {
    this.version += 1;
    this.updatedAt = Math.max(this.updatedAt, now);
  }

  // --- connections ---------------------------------------------------------

  setHostConnected(connected: boolean, now: number): void {
    if (this.hostConnected === connected) return;
    this.hostConnected = connected;
    this.bump(now);
  }

  setPlayerConnected(playerId: string, connected: boolean, now: number): void {
    const p = this.players.get(playerId);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    if (!connected) {
      this.maybeScheduleEarlyClose(now);
    } else {
      // A straggler coming back mid-prompt gets their time back: the
      // everyone-has-answered grace only ever counted connected players.
      const round = this.currentRound;
      if (this.phase === 'prompt' && round && !round.closed && !round.submissions.has(playerId)) {
        round.closeAt = undefined;
      }
    }
    this.bump(now);
  }

  // --- lobby ---------------------------------------------------------------

  configure(patch: Partial<RoomConfig>, now: number): RoomResult {
    if (this.phase !== 'lobby') return err('wrong_phase', 'Settings can only change in the lobby');
    const v = validateConfigPatch(patch, this.bank);
    if (!v.ok) return v;
    Object.assign(this.config, v.value);
    this.bump(now);
    return ok(null);
  }

  join(nameRaw: string, avatar: AvatarId, now: number): RoomResult<{ playerId: string; token: string }> {
    if (this.phase !== 'lobby') return err('game_in_progress', 'The game has already started — ask the host to restart, or wait for the next one');
    const name = cleanText(nameRaw);
    if (name.length < 1 || name.length > LIMITS.maxNameLength) {
      return err('bad_request', `Names are 1–${LIMITS.maxNameLength} characters`);
    }
    if (!AVATAR_IDS.includes(avatar)) return err('bad_request', 'Unknown avatar');
    if (this.players.size >= LIMITS.maxPlayersPerRoom) return err('room_full', `The room is full (${LIMITS.maxPlayersPerRoom} players)`);
    for (const p of this.players.values()) {
      if (p.name.toLowerCase() === name.toLowerCase()) return err('name_taken', `Someone is already called ${p.name}`);
    }
    // Avatars are unique while any are still free (20 avatars for a 20-person
    // crew). Once every animal is taken, latecomers may double up rather than
    // be locked out.
    const taken = new Set([...this.players.values()].map((p) => p.avatar));
    if (taken.size < AVATAR_IDS.length) {
      for (const p of this.players.values()) {
        if (p.avatar === avatar) return err('avatar_taken', `${p.name} already picked that one`);
      }
    }
    const player: PlayerRecord = {
      id: randomUUID(),
      token: randomUUID(),
      name,
      avatar,
      connected: true,
      depth: 0,
      joinedAt: now,
    };
    this.players.set(player.id, player);
    this.bump(now);
    return ok({ playerId: player.id, token: player.token });
  }

  resume(token: string): PlayerRecord | undefined {
    for (const p of this.players.values()) if (p.token === token) return p;
    return undefined;
  }

  kick(playerId: string, now: number): RoomResult {
    if (!this.players.has(playerId)) return err('bad_request', 'No such player');
    this.players.delete(playerId);
    this.effects.push({ type: 'kicked', playerId });
    this.maybeScheduleEarlyClose(now);
    // Kicking during a reveal changes the denominator: re-score now so the
    // groups on screen stay honest instead of shifting on the next moderation.
    const round = this.currentRound;
    if (round?.closed) this.scoreRound(round);
    this.bump(now);
    return ok(null);
  }

  // --- game flow -----------------------------------------------------------

  start(now: number): RoomResult {
    if (this.phase !== 'lobby') return err('wrong_phase', 'The game is already running');
    if (this.players.size === 0) return err('bad_request', 'Nobody has joined yet');
    if (this.config.promptIds.length === 0) return err('bad_request', 'Pick at least one prompt');
    this.rounds = [];
    this.finishedAt = undefined;
    for (const p of this.players.values()) {
      p.depth = 0;
      p.lastTier = undefined;
      p.lastPoints = undefined;
    }
    this.startRound(0, now);
    this.bump(now);
    return ok(null);
  }

  private startRound(index: number, now: number): void {
    const promptId = this.config.promptIds[index];
    if (!promptId) throw new Error(`no prompt at index ${index}`);
    const depthBefore: Record<string, number> = {};
    for (const p of this.players.values()) depthBefore[p.id] = p.depth;
    this.rounds = this.rounds.slice(0, index);
    this.rounds.push({
      index,
      promptId,
      startedAt: now,
      endsAt: now + this.config.secondsPerPrompt * 1000,
      closed: false,
      submissions: new Map(),
      depthBefore,
      rejectedKeys: new Set(),
      acceptedKeys: new Set(),
    });
    this.phase = 'prompt';
  }

  answer(playerId: string, roundIndex: number, textRaw: string, now: number): RoomResult {
    const player = this.players.get(playerId);
    if (!player) return err('not_player', 'You are not in this room');
    const round = this.currentRound;
    if (!round) return err('wrong_phase', 'The game has not started');
    if (roundIndex < round.index || (this.phase !== 'prompt' && roundIndex === round.index)) {
      return err('too_late', 'That prompt has closed');
    }
    if (roundIndex > round.index) return err('bad_request', 'That prompt has not started yet');
    if (this.phase !== 'prompt') return err('wrong_phase', 'Not taking answers right now');
    if (now > round.endsAt + ANSWER_ALLOWANCE_MS) return err('too_late', 'Time is up');
    if (round.submissions.has(playerId)) return err('already_answered', 'You have already locked in an answer');
    const text = cleanText(textRaw).slice(0, LIMITS.maxAnswerLength);
    if (!text) return err('bad_request', 'Type an answer first');
    // Strict validation: only answers the game recognises can be locked in.
    // A rejected answer is never recorded, so the player can keep trying
    // until the timer runs out.
    const invalid = this.validateAnswer(round.promptId, text);
    if (invalid) return invalid;
    round.submissions.set(playerId, { raw: text, at: now });
    this.maybeScheduleEarlyClose(now);
    this.bump(now);
    return ok(null);
  }

  /**
   * null when `text` is an acceptable answer for the prompt: a number for
   * closest-to-the-pin prompts, otherwise a bank match (typo-tolerant) or one
   * of the host's special answers for this prompt.
   */
  private validateAnswer(promptId: string, text: string): RoomError | null {
    const prompt = this.bank.getPrompt(promptId);
    if (!prompt) return null; // prompt vanished between restarts: accept, scoring will cope
    if (prompt.type === 'numeric') {
      return parseNumber(text) === null
        ? err('not_in_bank', 'That needs to be a number — digits like 240 work best')
        : null;
    }
    const matcher = this.bank.matcherFor(promptId);
    const m = matcher.match(text);
    if (m?.matched) return null;
    // Host specials are accepted even when they are not bank entries. They are
    // indexed without typo tolerance, the same way scoring resolves them.
    if (m) {
      for (const s of this.config.specialAnswers[promptId] ?? []) {
        const sk = matcher.match(s, { fuzzy: false });
        if (sk && sk.key === m.key) return null;
      }
    }
    return err('not_in_bank', `“${text}” isn't on our list for this one — have another crack`);
  }

  /** Arms the early-close grace timer when every connected player has answered. */
  private maybeScheduleEarlyClose(now: number): void {
    if (this.phase !== 'prompt' || !this.config.endEarlyWhenAllAnswered) return;
    const round = this.currentRound;
    if (!round || round.closed) return;
    let connected = 0;
    for (const p of this.players.values()) {
      if (!p.connected) continue;
      connected += 1;
      if (!round.submissions.has(p.id)) return;
    }
    if (connected === 0) return;
    const target = Math.min(now + LIMITS.allAnsweredGraceMs, round.endsAt + ANSWER_ALLOWANCE_MS);
    round.closeAt = round.closeAt === undefined ? target : Math.min(round.closeAt, target);
  }

  endRound(now: number): RoomResult {
    if (this.phase !== 'prompt') return err('wrong_phase', 'No prompt is open');
    this.closeRound(now);
    this.bump(now);
    return ok(null);
  }

  private closeRound(now: number): void {
    const round = this.currentRound;
    if (!round || round.closed) return;
    round.closeAt = undefined;
    round.closed = true;
    this.scoreRound(round);
    this.phase = 'reveal';
    this.effects.push({ type: 'round_closed', roundIndex: round.index });
    void now;
  }

  /** (Re)computes groups, results and player depths for a closed round. */
  private scoreRound(round: RoundRecord): void {
    const prompt = this.bank.getPrompt(round.promptId);
    const playerIds = [...this.players.keys()];
    const subs = [...round.submissions.entries()]
      .filter(([pid]) => this.players.has(pid))
      .map(([playerId, s]) => ({ playerId, raw: s.raw }));

    const out =
      prompt?.type === 'numeric' && prompt.numeric
        ? scoreNumericRound(subs, prompt.numeric.answer, { depthBefore: round.depthBefore, playerIds })
        : scoreOpenRound(subs, {
            matcher: this.bank.matcherFor(round.promptId),
            specialAnswers: this.config.specialAnswers[round.promptId] ?? [],
            rejectedKeys: round.rejectedKeys,
            acceptedKeys: round.acceptedKeys,
            depthBefore: round.depthBefore,
            playerIds,
          });

    round.groups = out.groups;
    round.results = out.results;
    round.validCount = out.validCount;
    round.numericAnswer = prompt?.type === 'numeric' ? prompt.numeric : undefined;

    for (const p of this.players.values()) {
      const r = out.results[p.id];
      if (!r) continue;
      p.depth = r.depthAfter;
      p.lastTier = r.tier;
      p.lastPoints = r.points;
    }
  }

  moderate(roundIndex: number, key: string, accepted: boolean, now: number): RoomResult {
    const round = this.currentRound;
    if (this.phase !== 'reveal' || !round || round.index !== roundIndex) {
      return err('wrong_phase', 'Answers can only be moderated during the reveal of the current prompt');
    }
    if (this.bank.getPrompt(round.promptId)?.type === 'numeric') {
      return err('bad_request', 'Closest-to-the-pin prompts are scored by distance and cannot be moderated');
    }
    const group = round.groups?.find((g) => g.key === key);
    if (!group) return err('bad_request', 'No such answer group');
    if (group.status === 'special') return err('bad_request', 'Special answers cannot be rejected');
    if (accepted) {
      // Accepting a rejected group undoes the rejection; accepting an
      // unverified group vouches for it.
      if (round.rejectedKeys.has(key)) round.rejectedKeys.delete(key);
      else if (group.status === 'unverified') round.acceptedKeys.add(key);
    } else {
      round.acceptedKeys.delete(key);
      round.rejectedKeys.add(key);
    }
    this.scoreRound(round);
    this.bump(now);
    return ok(null);
  }

  next(now: number): RoomResult {
    if (this.phase !== 'reveal') return err('wrong_phase', 'Nothing to advance from');
    const round = this.currentRound;
    const nextIndex = (round?.index ?? -1) + 1;
    if (nextIndex < this.config.promptIds.length) {
      this.startRound(nextIndex, now);
    } else {
      this.phase = 'results';
      this.finishedAt = now;
    }
    this.bump(now);
    return ok(null);
  }

  restart(now: number): RoomResult {
    this.phase = 'lobby';
    this.rounds = [];
    this.finishedAt = undefined;
    for (const p of this.players.values()) {
      p.depth = 0;
      p.lastTier = undefined;
      p.lastPoints = undefined;
    }
    this.bump(now);
    return ok(null);
  }

  // --- time ----------------------------------------------------------------

  /** When the manager must next call `tick`, or null if nothing is pending. */
  nextDeadline(): number | null {
    if (this.phase !== 'prompt') return null;
    const round = this.currentRound;
    if (!round || round.closed) return null;
    const hard = round.endsAt + ANSWER_ALLOWANCE_MS;
    return round.closeAt === undefined ? hard : Math.min(hard, round.closeAt);
  }

  /** Closes the open prompt once its deadline has passed. Returns true if state changed. */
  tick(now: number): boolean {
    const deadline = this.nextDeadline();
    if (deadline === null || now < deadline) return false;
    this.closeRound(now);
    this.bump(now);
    return true;
  }

  // --- dispatch ------------------------------------------------------------

  /** Applies a validated in-room message from `actor`. Connection-level messages never reach here. */
  handle(actor: Actor, msg: ParsedClientMessage, now: number): RoomResult {
    switch (msg.t) {
      case 'host:config':
      case 'host:start':
      case 'host:end_round':
      case 'host:next':
      case 'host:moderate':
      case 'host:kick':
      case 'host:restart': {
        if (actor.kind !== 'host') return err('not_host', 'Only the host can do that');
        switch (msg.t) {
          case 'host:config':
            return this.configure(msg.patch, now);
          case 'host:start':
            return this.start(now);
          case 'host:end_round':
            return this.endRound(now);
          case 'host:next':
            return this.next(now);
          case 'host:moderate':
            return this.moderate(msg.roundIndex, msg.key, msg.accepted, now);
          case 'host:kick':
            return this.kick(msg.playerId, now);
          case 'host:restart':
            return this.restart(now);
        }
        break;
      }
      case 'player:answer': {
        if (actor.kind !== 'player') return err('not_player', 'Only players answer');
        return this.answer(actor.playerId, msg.roundIndex, msg.text, now);
      }
      default:
        return err('bad_request', `Unexpected message ${msg.t}`);
    }
    return err('bad_request', 'Unexpected message');
  }

  // --- persistence ---------------------------------------------------------

  snapshot(): RoomSnapshot {
    return {
      v: 1,
      code: this.code,
      hostToken: this.hostToken,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      finishedAt: this.finishedAt,
      version: this.version,
      phase: this.phase,
      config: structuredClone(this.config),
      players: [...this.players.values()].map((p) => ({ ...p })),
      rounds: this.rounds.map((r) => ({
        ...r,
        submissions: [...r.submissions.entries()],
        rejectedKeys: [...r.rejectedKeys],
        acceptedKeys: [...r.acceptedKeys],
        groups: r.groups ? structuredClone(r.groups) : undefined,
        results: r.results ? structuredClone(r.results) : undefined,
        depthBefore: { ...r.depthBefore },
      })),
    };
  }

  static fromSnapshot(snap: RoomSnapshot, bank: BankLike, now: number): Room {
    const room = new Room({ code: snap.code, bank, now: snap.createdAt, hostToken: snap.hostToken });
    room.config = { ...defaultConfig(bank), ...snap.config };
    // Prompts may have been renamed/removed between restarts; drop unknown ids.
    room.config.promptIds = room.config.promptIds.filter((id) => bank.has(id));
    if (room.config.promptIds.length === 0) room.config.promptIds = defaultConfig(bank).promptIds;
    room.phase = snap.phase;
    // Jump well past any frame a phone saw before the restart, so nothing is
    // discarded as stale (commits inside the persist debounce were never stored).
    room.version = snap.version + 1_000;
    room.updatedAt = snap.updatedAt;
    room.finishedAt = snap.finishedAt;
    for (const p of snap.players) room.players.set(p.id, { ...p, connected: false });
    room.rounds = snap.rounds.map((r) => ({
      ...r,
      submissions: new Map(r.submissions),
      rejectedKeys: new Set(r.rejectedKeys),
      acceptedKeys: new Set(r.acceptedKeys ?? []),
    }));
    // A round that was open when we went down: re-score if its deadline already passed.
    if (room.phase === 'prompt') {
      const round = room.currentRound;
      if (!round || !bank.has(round.promptId)) {
        room.phase = 'lobby';
        room.rounds = [];
      } else if (now >= round.endsAt + ANSWER_ALLOWANCE_MS) {
        room.closeRound(now);
      }
    }
    room.updatedAt = now;
    return room;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function defaultConfig(bank: BankLike): RoomConfig {
  const ids = 'defaultPromptIds' in bank && typeof (bank as { defaultPromptIds?: () => string[] }).defaultPromptIds === 'function'
    ? (bank as { defaultPromptIds: () => string[] }).defaultPromptIds()
    : bank
        .listSummaries()
        .filter((p) => p.approved)
        .slice(0, MAX_ROUNDS)
        .map((p) => p.id);
  return {
    promptIds: ids,
    secondsPerPrompt: LIMITS.defaultSecondsPerPrompt,
    endEarlyWhenAllAnswered: true,
    specialAnswers: structuredClone(DEFAULT_SPECIAL_ANSWERS),
  };
}

export function randomRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}
