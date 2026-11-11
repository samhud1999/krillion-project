/**
 * Separation Creek Krillion — shared contract between server and client.
 *
 * Everything in this file is JSON-serialisable. The server is authoritative:
 * it owns the room state machine and pushes a role-specific projection
 * (HostView / PlayerView) to each socket after every change. Clients never
 * compute scores; they only render what the server sends.
 */

export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Prompt bank (loaded from server/data/bank/*.json)
// ---------------------------------------------------------------------------

export type PromptType = 'open' | 'numeric';
export type PromptCategory = 'starter' | 'local' | 'closest';
/** Editorial familiarity of a curated answer. Used to decide whether a unique
 *  answer is a genuine deep cut (→ One in a Krillion) or just unusual. */
export type BankTier = 'common' | 'uncommon' | 'rare' | 'deep';

export interface BankAnswer {
  canonical: string;
  aliases: string[];
  tier: BankTier;
  /**
   * The answer everyone in the room can see out the window (Lorne at a
   * Separation Creek table). Always scores a puddle (10) no matter how few
   * people said it — a host special answer still trumps it.
   */
  obvious?: boolean;
  note?: string;
}

export interface NumericAnswer {
  answer: number;
  unit?: string;
  source?: string;
  asOf?: string;
  alternatives?: string;
}

export interface PromptBank {
  id: string;
  text: string;
  type: PromptType;
  category: PromptCategory;
  /** Drafts (local flavour, closest-to-the-pin) ship with approved=false and
   *  are hidden from the default set until the host opts in. */
  approved: boolean;
  answers?: BankAnswer[];
  numeric?: NumericAnswer;
  hostNotes?: string;
}

/** What a client needs to know about a prompt (no answers leak to players). */
export interface PromptSummary {
  id: string;
  text: string;
  type: PromptType;
  category: PromptCategory;
  approved: boolean;
  answerCount: number;
  hostNotes?: string;
}

// ---------------------------------------------------------------------------
// Scoring tiers & depth
// ---------------------------------------------------------------------------

/**
 * dry      0   no answer / rejected
 * puddle   10  most of the room said it (Krillion: Plankton)
 * shallows 30  a decent chunk said it   (Krillion: Schooler)
 * rockpool 60  only a couple said it    (Krillion: Rare)
 * deepcut  85  you were the only one    (Krillion: Deep Cut)
 * krillion 100 only one, and a true deep cut or a special answer (One in a Krillion)
 */
export type TierId = 'dry' | 'puddle' | 'shallows' | 'rockpool' | 'deepcut' | 'krillion';

export interface TierInfo {
  id: TierId;
  label: string;
  krillionName: string;
  points: number;
  blurb: string;
}

/** 1 point = 1 metre down the creek. 7 prompts × 100 = 700 m to the creek mouth. */
export const METRES_PER_POINT = 1;
export const MAX_ROUNDS = 7;
export const MAX_DEPTH = 700;

export type ZoneId = 'bridge' | 'rockpools' | 'beach' | 'mouth';

export interface ZoneInfo {
  id: ZoneId;
  label: string;
  /** inclusive start depth in metres */
  from: number;
  /** exclusive end depth in metres (last zone ends at MAX_DEPTH) */
  to: number;
  blurb: string;
}

// ---------------------------------------------------------------------------
// Avatars (20 — one per player on a full night)
// ---------------------------------------------------------------------------

export type AvatarId =
  | 'koala'
  | 'kookaburra'
  | 'echidna'
  | 'wombat'
  | 'platypus'
  | 'wallaby'
  | 'kingparrot'
  | 'cockatoo'
  | 'rosella'
  | 'magpie'
  | 'possum'
  | 'bluetongue'
  | 'crab'
  | 'starfish'
  | 'octopus'
  | 'seal'
  | 'penguin'
  | 'pelican'
  | 'hoodedplover'
  | 'bluebottle';

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------

export type RoomPhase = 'lobby' | 'prompt' | 'reveal' | 'results';

export interface RoomConfig {
  /** Ordered prompt ids for this game. Length 1..MAX_ROUNDS (default 7). */
  promptIds: string[];
  /** Seconds players get per prompt. Default 20. */
  secondsPerPrompt: number;
  /** End the prompt early once every connected player has answered. Default true. */
  endEarlyWhenAllAnswered: boolean;
  /**
   * Sam's special answers, keyed by prompt id. Any submission that matches one
   * of these strings (after normalisation / alias matching) scores the top
   * tier regardless of how many people said it.
   */
  specialAnswers: Record<string, string[]>;
  /** Optional title shown on the host screen, e.g. "Sep Creek 2026". */
  title?: string;
}

export interface PlayerPublic {
  id: string;
  name: string;
  avatar: AvatarId;
  connected: boolean;
  /** Cumulative metres down the creek. */
  depth: number;
  /** Tier earned in the most recently revealed round. */
  lastTier?: TierId;
  /** Points earned in the most recently revealed round. */
  lastPoints?: number;
  joinedAt: number;
}

export type AnswerGroupStatus =
  /** matched a curated bank answer */
  | 'bank'
  /** not in the bank; accepted by default, host may reject */
  | 'unverified'
  /** matched one of the host's special answers */
  | 'special'
  /** host rejected it — scores 0 */
  | 'rejected';

export interface AnswerGroup {
  /** canonical grouping key (bank canonical or normalised text) */
  key: string;
  /** what to show on screen */
  display: string;
  count: number;
  playerIds: string[];
  status: AnswerGroupStatus;
  bankTier?: BankTier;
  /** flagged obvious in the bank: pinned to a puddle regardless of rarity */
  obvious?: boolean;
  /**
   * Unverified answers that only one person gave score a rock pool (60) until
   * the host vouches for them with host:moderate accepted=true, which sets
   * this flag and lifts them to a deep cut (85). Stops "Lorneeeee" beating
   * eight honest "Lorne"s.
   */
  vouched?: boolean;
  tier: TierId;
  points: number;
}

export interface RoundResultEntry {
  playerId: string;
  raw: string;
  /** group key the answer landed in; undefined if blank */
  key?: string;
  tier: TierId;
  points: number;
  /** cumulative depth after this round */
  depthAfter: number;
  /** numeric prompts only */
  numeric?: { guess: number | null; distance: number | null; rank: number | null };
}

export interface RoundPublic {
  index: number;
  promptId: string;
  prompt: { text: string; type: PromptType };
  startedAt: number;
  endsAt: number;
  /** who has locked in an answer (contents hidden until reveal) */
  submittedPlayerIds: string[];
  /** present from 'reveal' onwards */
  groups?: AnswerGroup[];
  results?: Record<string, RoundResultEntry>;
  /** numeric prompts, from 'reveal' onwards */
  numericAnswer?: NumericAnswer;
  /** number of valid (non-blank, non-rejected) answers used as the rarity denominator */
  validCount?: number;
}

export interface RoomPublic {
  code: string;
  phase: RoomPhase;
  config: RoomConfig;
  players: PlayerPublic[];
  round?: RoundPublic;
  roundCount: number;
  hostConnected: boolean;
  /** server wall clock at send time, for timer offset correction */
  serverNow: number;
  createdAt: number;
  /** incremented on every change; clients can ignore stale frames */
  version: number;
}

export interface HostView extends RoomPublic {
  role: 'host';
  /** prompts available for the setup panel */
  prompts: PromptSummary[];
  /** host-only: live view of what each player typed (reveal and later only) */
  roundHistory: RoundPublic[];
  joinUrl: string;
}

export interface PlayerView extends RoomPublic {
  role: 'player';
  me: {
    id: string;
    token: string;
    /** what I submitted this round, if anything */
    submission?: string;
    /** my result for the current round, from 'reveal' onwards */
    result?: RoundResultEntry;
    /** my results for every revealed round */
    history: RoundResultEntry[];
  };
}

export type View = HostView | PlayerView;

// ---------------------------------------------------------------------------
// WebSocket protocol
// ---------------------------------------------------------------------------

export type ClientMessage =
  /** `pin` is required only when the server is started with HOST_PIN set. */
  | { t: 'host:create'; config?: Partial<RoomConfig>; pin?: string }
  | { t: 'host:resume'; code: string; hostToken: string }
  | { t: 'host:config'; patch: Partial<RoomConfig> }
  | { t: 'host:start' }
  /** end the current prompt's timer now */
  | { t: 'host:end_round' }
  /** reveal → next prompt, or reveal → results after the last prompt */
  | { t: 'host:next' }
  /** accept/reject an unverified or rejected group in the current reveal */
  | { t: 'host:moderate'; roundIndex: number; key: string; accepted: boolean }
  | { t: 'host:kick'; playerId: string }
  /** back to lobby with the same players, depths reset */
  | { t: 'host:restart' }
  | { t: 'player:join'; code: string; name: string; avatar: AvatarId }
  | { t: 'player:resume'; code: string; token: string }
  | { t: 'player:answer'; roundIndex: number; text: string }
  | { t: 'ping'; sentAt: number };

export type ServerErrorCode =
  | 'bad_request'
  | 'room_not_found'
  | 'room_full'
  | 'name_taken'
  | 'avatar_taken'
  | 'not_host'
  | 'not_player'
  | 'wrong_phase'
  | 'too_late'
  | 'already_answered'
  | 'game_in_progress'
  | 'pin_required'
  | 'protocol_mismatch';

export type ServerMessage =
  | { t: 'hello'; protocol: number; serverNow: number }
  | { t: 'host:created'; code: string; hostToken: string }
  | { t: 'player:joined'; playerId: string; token: string; code: string }
  | { t: 'state'; view: View }
  | { t: 'pong'; sentAt: number; serverNow: number }
  | { t: 'kicked' }
  | { t: 'error'; code: ServerErrorCode; message: string };

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const LIMITS = {
  maxPlayersPerRoom: 24,
  maxNameLength: 16,
  maxAnswerLength: 60,
  minSecondsPerPrompt: 10,
  maxSecondsPerPrompt: 60,
  defaultSecondsPerPrompt: 20,
  /** grace after the last player answers before the prompt closes (ms) */
  allAnsweredGraceMs: 1200,
  /** idle rooms are evicted after this long with no sockets (ms) */
  roomIdleEvictMs: 6 * 60 * 60 * 1000,
} as const;
