/**
 * Pure scoring logic. No I/O, no Date.now(): everything the server needs to
 * turn a round's submissions into tiers and metres lives here so it can be
 * unit-tested in isolation.
 */
import type {
  AnswerGroup,
  AnswerGroupStatus,
  BankAnswer,
  BankTier,
  PromptBank,
  RoundResultEntry,
  TierId,
} from './types.js';
import { TIERS } from './theme.js';

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const LEADING_ARTICLES = /^(the|a|an)\s+/;

/** Place-name abbreviations expanded so "Mt Eliza" and "Mount Eliza" meet (and "sepcreek" still squashes to "sep creek"). */
const TOKEN_MAP: Record<string, string> = {
  mt: 'mount',
  st: 'saint',
  pt: 'point',
  nth: 'north',
  sth: 'south',
  ck: 'creek',
  rv: 'river',
  hl: 'hill',
  hls: 'hills',
  hts: 'heights',
};

/**
 * Lowercase, strip accents and punctuation, collapse whitespace, drop a
 * leading article, fold common abbreviations. "The Twelve Apostles!" →
 * "twelve apostles"; "Mount Eliza" → "mt eliza".
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(LEADING_ARTICLES, '')
    .trim()
    .split(' ')
    .map((t) => TOKEN_MAP[t] ?? t)
    .join(' ');
}

/**
 * Very light English singulariser used only as a secondary match key. Words
 * ending in -y and -ies both map to -ie so "mozzie", "mozzies" and "lolly",
 * "lollies" each share one key; the result is never shown to anyone.
 */
export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + 'ie';
  if (/y$/.test(word)) return word.slice(0, -1) + 'ie';
  if (/(ches|shes|xes|zes|ses)$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Removes spaces: a secondary key for answers typed without them. */
export function squash(s: string): string {
  return s.replace(/ /g, '');
}

/**
 * Sound-alike folding for typo matching: "qu" and "ck" become "k", "ph"
 * becomes "f", doubled letters collapse. "Torkay" and "Torquay" meet, as do
 * "Koorumbura" and "Korumburra". Only ever used as a comparison key.
 */
export function fold(s: string): string {
  return s
    .replace(/qu/g, 'k')
    .replace(/ck/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/(.)\1+/g, '$1');
}

export function singularizePhrase(phrase: string): string {
  const parts = phrase.split(' ');
  if (parts.length === 0) return phrase;
  parts[parts.length - 1] = singularize(parts[parts.length - 1]!);
  return parts.join(' ');
}

/** Damerau–Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const d: number[][] = [];
  for (let i = 0; i <= al; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    d[0]![j] = j;
  }
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[al]![bl]!;
}

/**
 * How many typos we forgive for a string of this length (measured without
 * spaces). Generous on purpose: "Torkay", "Appolo bay" and "Koorumbura"
 * should all land, and the ambiguity rule in the matcher stops a typo from
 * guessing between two real answers.
 */
export function fuzzyBudget(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  if (len <= 11) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Bank matching
// ---------------------------------------------------------------------------

export interface MatchResult {
  /** grouping key: the bank canonical when matched, else the normalised text */
  key: string;
  display: string;
  matched: boolean;
  bankTier?: BankTier;
  /** 'exact' alias/canonical hit, 'singular' after singularising, 'fuzzy' within edit budget */
  via?: 'exact' | 'singular' | 'fuzzy';
}

export interface MatchOptions {
  /** allow typo-tolerant matching (default true); special answers resolve without it */
  fuzzy?: boolean;
}

export interface Matcher {
  match(raw: string, opts?: MatchOptions): MatchResult | null;
  /** canonical display for a key we produced earlier */
  displayFor(key: string): string;
}

/**
 * Builds a matcher for one prompt. Aliases and canonicals are indexed by their
 * normalised form (canonicals first, so an alias can never shadow one); a form
 * that two entries both claim is ambiguous and matches neither. Fuzzy matching
 * only runs when the exact and singularised lookups miss, only against
 * candidates of similar length, and only when exactly one entry is in range,
 * so "walan" stays unverified instead of guessing between Ballan and Wallan.
 */
export function buildMatcher(bank: Pick<PromptBank, 'answers'>): Matcher {
  const exact = new Map<string, BankAnswer>();
  const singular = new Map<string, BankAnswer>();
  /** spaces removed, so "apollobay" and "st kilda" typed as "stkilda" still land */
  const squashed = new Map<string, BankAnswer>();
  const ambiguous = new Set<string>();
  const candidates: { norm: string; fold: string; entry: BankAnswer }[] = [];

  const index = (map: Map<string, BankAnswer>, key: string, entry: BankAnswer) => {
    const existing = map.get(key);
    if (existing && existing !== entry) ambiguous.add(key);
    else if (!existing) map.set(key, entry);
  };
  const add = (form: string, entry: BankAnswer) => {
    const n = normalizeAnswer(form);
    if (!n) return;
    index(exact, n, entry);
    index(singular, singularizePhrase(n), entry);
    index(squashed, squash(singularizePhrase(n)), entry);
    candidates.push({ norm: n, fold: fold(squash(n)), entry });
  };

  const entries = bank.answers ?? [];
  for (const entry of entries) add(entry.canonical, entry);
  for (const entry of entries) for (const f of entry.aliases ?? []) add(f, entry);

  function hit(entry: BankAnswer, via: MatchResult['via']): MatchResult {
    return {
      key: `bank:${normalizeAnswer(entry.canonical)}`,
      display: entry.canonical,
      matched: true,
      bankTier: entry.tier,
      via,
    };
  }

  const displayCache = new Map<string, string>();
  for (const entry of bank.answers ?? []) {
    displayCache.set(`bank:${normalizeAnswer(entry.canonical)}`, entry.canonical);
  }

  const unverified = (raw: string, n: string): MatchResult => {
    // Unverified: group by normalised (and singularised) text.
    const key = `free:${singularizePhrase(n)}`;
    if (!displayCache.has(key)) displayCache.set(key, titleCase(raw.trim()));
    return { key, display: displayCache.get(key)!, matched: false };
  };

  return {
    match(raw: string, opts?: MatchOptions): MatchResult | null {
      const n = normalizeAnswer(raw);
      if (!n) return null;
      if (ambiguous.has(n)) return unverified(raw, n);
      const e = exact.get(n);
      if (e) return hit(e, 'exact');
      const sKey = singularizePhrase(n);
      if (ambiguous.has(sKey)) return unverified(raw, n);
      const s = singular.get(sKey);
      if (s) return hit(s, 'singular');
      // Missing or extra spaces: "apollobay", "tim tam s"
      const sq = squash(sKey);
      if (ambiguous.has(sq)) return unverified(raw, n);
      const q = squashed.get(sq);
      if (q) return hit(q, 'singular');
      // Typos, compared without spaces and sound-folded, so a dropped space,
      // a doubled letter and a "k" for "qu" all still land.
      const target = fold(squash(n));
      const budget = opts?.fuzzy === false ? 0 : fuzzyBudget(target.length);
      if (budget > 0) {
        let best: { d: number; entry: BankAnswer } | null = null;
        const within = new Set<BankAnswer>();
        for (const c of candidates) {
          if (Math.abs(c.fold.length - target.length) > budget) continue;
          const d = editDistance(target, c.fold);
          if (d > budget) continue;
          within.add(c.entry);
          if (within.size > 1) break;
          if (!best || d < best.d) best = { d, entry: c.entry };
        }
        if (best && within.size === 1) return hit(best.entry, 'fuzzy');
      }
      return unverified(raw, n);
    },
    displayFor(key: string): string {
      return displayCache.get(key) ?? key.replace(/^(bank|free):/, '');
    },
  };
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Rarity → tier
// ---------------------------------------------------------------------------

export interface RarityInput {
  /** players who gave this exact answer */
  count: number;
  /** valid (non-blank, non-rejected) answers in the round */
  validCount: number;
  bankTier?: BankTier;
  special?: boolean;
  /** the answer is not in the curated bank */
  unverified?: boolean;
  /** the host has vouched for an unverified answer */
  vouched?: boolean;
}

/**
 * Live rarity among the people in the room.
 *   special answer                     → krillion, always
 *   count = 1, in the bank             → deepcut, or krillion if the bank calls it a deep cut
 *   count = 1, not in the bank         → rockpool until the host vouches (then deepcut)
 *   count = 2                          → rockpool in a room of 8+, shallows in 5–7, puddle below
 *   share ≥ 30 %                       → puddle
 *   20 % ≤ share < 30 %                → shallows
 *   otherwise                          → rockpool
 * With a tiny room (validCount < 4) a lone bank answer is only a deepcut:
 * being unique among three people proves little.
 */
export function tierForRarity(input: RarityInput): TierId {
  const { count, validCount, bankTier, special, unverified, vouched } = input;
  if (special) return 'krillion';
  if (count <= 0 || validCount <= 0) return 'dry';
  if (count === 1) {
    if (unverified && !vouched) return 'rockpool';
    if (bankTier === 'deep' && validCount >= 4) return 'krillion';
    return 'deepcut';
  }
  if (count === 2) {
    if (validCount >= 8) return 'rockpool';
    if (validCount >= 5) return 'shallows';
    return 'puddle';
  }
  const share = count / validCount;
  if (share >= 0.3) return 'puddle';
  if (share >= 0.2) return 'shallows';
  return 'rockpool';
}

// ---------------------------------------------------------------------------
// Open prompts: group + score
// ---------------------------------------------------------------------------

export interface OpenSubmission {
  playerId: string;
  raw: string;
}

export interface ScoreOpenOptions {
  matcher: Matcher;
  /** host-flagged strings for this prompt; matched through the same matcher */
  specialAnswers?: string[];
  /** group keys the host has rejected */
  rejectedKeys?: Set<string>;
  /** unverified group keys the host has vouched for */
  acceptedKeys?: Set<string>;
  /** depth of each player before this round */
  depthBefore: Record<string, number>;
  /** every player who should get a result row, including ones who never answered */
  playerIds: string[];
}

export interface ScoreOpenOutput {
  groups: AnswerGroup[];
  results: Record<string, RoundResultEntry>;
  validCount: number;
}

export function scoreOpenRound(subs: OpenSubmission[], opts: ScoreOpenOptions): ScoreOpenOutput {
  const { matcher, depthBefore, playerIds } = opts;
  const rejected = opts.rejectedKeys ?? new Set<string>();
  const accepted = opts.acceptedKeys ?? new Set<string>();

  // Specials resolve without typo tolerance: a mistyped special must not
  // promote a whole common group to the top tier.
  const specialKeys = new Set<string>();
  for (const s of opts.specialAnswers ?? []) {
    const m = matcher.match(s, { fuzzy: false });
    if (m) specialKeys.add(m.key);
  }

  const byKey = new Map<string, AnswerGroup>();
  const subKey = new Map<string, string | undefined>();

  for (const sub of subs) {
    const m = matcher.match(sub.raw);
    if (!m) {
      subKey.set(sub.playerId, undefined);
      continue;
    }
    subKey.set(sub.playerId, m.key);
    let g = byKey.get(m.key);
    if (!g) {
      let status: AnswerGroupStatus = m.matched ? 'bank' : 'unverified';
      if (specialKeys.has(m.key)) status = 'special';
      if (rejected.has(m.key)) status = 'rejected';
      g = {
        key: m.key,
        display: m.display,
        count: 0,
        playerIds: [],
        status,
        bankTier: m.bankTier,
        vouched: status === 'unverified' && accepted.has(m.key) ? true : undefined,
        tier: 'dry',
        points: 0,
      };
      byKey.set(m.key, g);
    }
    g.count += 1;
    g.playerIds.push(sub.playerId);
  }

  const groups = [...byKey.values()];
  const validCount = groups.filter((g) => g.status !== 'rejected').reduce((n, g) => n + g.count, 0);

  for (const g of groups) {
    if (g.status === 'rejected') {
      g.tier = 'dry';
      g.points = 0;
      continue;
    }
    g.tier = tierForRarity({
      count: g.count,
      validCount,
      bankTier: g.bankTier,
      special: g.status === 'special',
      unverified: g.status === 'unverified',
      vouched: g.vouched,
    });
    g.points = TIERS[g.tier].points;
  }

  // Rarest first, then alphabetical for stable display.
  groups.sort((a, b) => b.points - a.points || a.count - b.count || a.display.localeCompare(b.display));

  const results: Record<string, RoundResultEntry> = {};
  const rawByPlayer = new Map(subs.map((s) => [s.playerId, s.raw] as const));
  for (const pid of playerIds) {
    const key = subKey.get(pid);
    const g = key ? byKey.get(key) : undefined;
    const points = g ? g.points : 0;
    const before = depthBefore[pid] ?? 0;
    results[pid] = {
      playerId: pid,
      raw: rawByPlayer.get(pid) ?? '',
      key,
      tier: g ? g.tier : 'dry',
      points,
      depthAfter: before + points,
    };
  }

  return { groups, results, validCount };
}

// ---------------------------------------------------------------------------
// Numeric prompts: closest to the pin
// ---------------------------------------------------------------------------

export interface NumericSubmission {
  playerId: string;
  raw: string;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

/** "two hundred and fifty", "a hundred", "eighteen", "about thirty" → number; null if no number words. */
function wordsToNumber(text: string): number | null {
  let total = 0;
  let current = 0;
  let found = false;
  for (const tok of text.split(' ')) {
    if (tok in NUMBER_WORDS) {
      current += NUMBER_WORDS[tok]!;
      found = true;
    } else if (tok === 'hundred') {
      current = (current || 1) * 100;
      found = true;
    } else if (tok === 'thousand' || tok === 'million') {
      total += (current || 1) * (tok === 'thousand' ? 1_000 : 1_000_000);
      current = 0;
      found = true;
    }
    // every other word (about, roughly, a, and, ish, people…) is ignored
  }
  return found ? total + current : null;
}

/**
 * Parses "243", "243 km", "1,200", "70 000", "about 2.5k", "two hundred" → number;
 * null if nothing usable. A "k" only scales when glued to the digits ("2.5k"),
 * since "250 k" is how people write 250 kilometres.
 */
export function parseNumber(raw: string): number | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s(?=\d{3}\b)/g, '$1')
    .trim();
  const m = cleaned.match(/-?\d+(?:\.\d+)?(?:(k)(?![a-z])|\s*(thousand|million|mil)(?![a-z]))?/);
  if (!m) return wordsToNumber(cleaned.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' '));
  let v = parseFloat(m[0]);
  const suffix = m[1] ?? m[2];
  if (suffix === 'k' || suffix === 'thousand') v *= 1_000;
  if (suffix === 'million' || suffix === 'mil') v *= 1_000_000;
  return Number.isFinite(v) ? v : null;
}

/**
 * Rank by distance; ties share the better rank.
 *   rank 1 → krillion (100), rank 2 → deepcut (85), rank 3 → rockpool (60),
 *   top half → shallows (30), the rest → puddle (10), no number → dry (0).
 */
export function tierForNumericRank(rank: number, answered: number): TierId {
  if (rank <= 0) return 'dry';
  if (rank === 1) return 'krillion';
  if (rank === 2) return 'deepcut';
  if (rank === 3) return 'rockpool';
  if (rank <= Math.ceil(answered / 2)) return 'shallows';
  return 'puddle';
}

export function scoreNumericRound(
  subs: NumericSubmission[],
  answer: number,
  opts: { depthBefore: Record<string, number>; playerIds: string[] },
): ScoreOpenOutput {
  const parsed = subs
    .map((s) => ({ playerId: s.playerId, raw: s.raw, guess: parseNumber(s.raw) }))
    .filter((s): s is { playerId: string; raw: string; guess: number } => s.guess !== null)
    .map((s) => ({ ...s, distance: Math.abs(s.guess - answer) }))
    .sort((a, b) => a.distance - b.distance);

  const answered = parsed.length;
  const rankByPlayer = new Map<string, number>();
  let lastDistance: number | null = null;
  let lastRank = 0;
  parsed.forEach((p, i) => {
    const rank = lastDistance !== null && p.distance === lastDistance ? lastRank : i + 1;
    rankByPlayer.set(p.playerId, rank);
    lastDistance = p.distance;
    lastRank = rank;
  });

  const results: Record<string, RoundResultEntry> = {};
  const groups: AnswerGroup[] = [];
  const rawByPlayer = new Map(subs.map((s) => [s.playerId, s.raw] as const));
  const parsedByPlayer = new Map(parsed.map((p) => [p.playerId, p] as const));

  for (const pid of opts.playerIds) {
    const p = parsedByPlayer.get(pid);
    const rank = p ? rankByPlayer.get(pid)! : 0;
    const tier = p ? tierForNumericRank(rank, answered) : 'dry';
    const points = TIERS[tier].points;
    const before = opts.depthBefore[pid] ?? 0;
    results[pid] = {
      playerId: pid,
      raw: rawByPlayer.get(pid) ?? '',
      key: p ? `num:${p.guess}` : undefined,
      tier,
      points,
      depthAfter: before + points,
      numeric: { guess: p ? p.guess : null, distance: p ? p.distance : null, rank: p ? rank : null },
    };
    if (p) {
      groups.push({
        key: `num:${p.guess}`,
        display: formatNumber(p.guess),
        count: 1,
        playerIds: [pid],
        status: 'bank',
        tier,
        points,
      });
    }
  }
  groups.sort((a, b) => b.points - a.points || a.display.localeCompare(b.display));
  return { groups, results, validCount: answered };
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-AU') : n.toLocaleString('en-AU', { maximumFractionDigits: 2 });
}
