import type { PlayerPublic, RoundResultEntry, TierId } from '@shared/types';
import { MAX_ROUNDS } from '@shared/types';
import { zoneForDepth } from '@shared/theme';

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function metres(n: number): string {
  return `${Math.round(n).toLocaleString('en-AU')} m`;
}

export interface Ranked {
  player: PlayerPublic;
  rank: number;
}

/** Deepest first; equal depths share a rank. */
export function rankPlayers(players: PlayerPublic[]): Ranked[] {
  const sorted = [...players].sort((a, b) => b.depth - a.depth || a.joinedAt - b.joinedAt);
  const out: Ranked[] = [];
  let lastDepth: number | null = null;
  let lastRank = 0;
  sorted.forEach((p, i) => {
    const rank = lastDepth !== null && p.depth === lastDepth ? lastRank : i + 1;
    out.push({ player: p, rank });
    lastDepth = p.depth;
    lastRank = rank;
  });
  return out;
}

export const TIER_EMOJI: Record<TierId, string> = {
  dry: '⬛',
  puddle: '🌉',
  shallows: '💧',
  rockpool: '🪨',
  deepcut: '🌊',
  krillion: '🦐',
};

export function shareText(opts: {
  depth: number;
  history: RoundResultEntry[];
  roundCount: number;
  title?: string;
}): string {
  const zone = zoneForDepth(opts.depth);
  const rounds = Math.max(1, Math.min(MAX_ROUNDS, opts.roundCount || opts.history.length));
  const emoji = opts.history.map((h) => TIER_EMOJI[h.tier] ?? '⬛').join('');
  const name = opts.title?.trim() ? `${opts.title.trim()} · Separation Creek Krillion` : 'Separation Creek Krillion';
  return `${name} 🦐 ${metres(opts.depth)} — ${zone.label.toLowerCase()} ${emoji} (${opts.history.length}/${rounds})`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
