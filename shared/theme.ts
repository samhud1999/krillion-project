import type { AvatarId, TierId, TierInfo, ZoneId, ZoneInfo } from './types.js';
import { MAX_DEPTH } from './types.js';

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export const TIERS: Record<TierId, TierInfo> = {
  dry: {
    id: 'dry',
    label: 'High and dry',
    krillionName: 'No dive',
    points: 0,
    blurb: 'No answer, or the host knocked it back.',
  },
  puddle: {
    id: 'puddle',
    label: 'Puddle',
    krillionName: 'Plankton',
    points: 10,
    blurb: 'Half the room said it. Barely got your feet wet.',
  },
  shallows: {
    id: 'shallows',
    label: 'Shallows',
    krillionName: 'Schooler',
    points: 30,
    blurb: 'A few others had the same idea.',
  },
  rockpool: {
    id: 'rockpool',
    label: 'Rock pool',
    krillionName: 'Rare',
    points: 60,
    blurb: 'Only a couple of you went there.',
  },
  deepcut: {
    id: 'deepcut',
    label: 'Deep cut',
    krillionName: 'Deep Cut',
    points: 85,
    blurb: 'Nobody else said it.',
  },
  krillion: {
    id: 'krillion',
    label: 'One in a Krillion',
    krillionName: 'One in a Krillion',
    points: 100,
    blurb: 'Alone, and a genuine deep cut. Straight to the creek mouth.',
  },
};

export const TIER_ORDER: TierId[] = ['dry', 'puddle', 'shallows', 'rockpool', 'deepcut', 'krillion'];

// ---------------------------------------------------------------------------
// Zones down the creek (metres from the Great Ocean Road bridge)
// ---------------------------------------------------------------------------

export const ZONES: ZoneInfo[] = [
  {
    id: 'bridge',
    label: 'The bridge',
    from: 0,
    to: 100,
    blurb: 'Under the Great Ocean Road bridge. Tannin water, tree ferns, a lot of talk.',
  },
  {
    id: 'rockpools',
    label: 'The rock pools',
    from: 100,
    to: 300,
    blurb: 'Anemones, crabs, Neptune’s necklace. Watch your footing.',
  },
  {
    id: 'beach',
    label: 'The beach',
    from: 300,
    to: 520,
    blurb: 'Out past the dunes, where the creek spreads over the sand.',
  },
  {
    id: 'mouth',
    label: 'The creek mouth',
    from: 520,
    to: MAX_DEPTH,
    blurb: 'Where Separation Creek meets Bass Strait. The trench.',
  },
];

export function zoneForDepth(depth: number): ZoneInfo {
  const d = Math.max(0, Math.min(MAX_DEPTH, depth));
  for (const z of ZONES) {
    if (d >= z.from && d < z.to) return z;
  }
  return ZONES[ZONES.length - 1]!;
}

export function zoneById(id: ZoneId): ZoneInfo {
  return ZONES.find((z) => z.id === id) ?? ZONES[0]!;
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export interface AvatarInfo {
  id: AvatarId;
  name: string;
  /** where you'd meet it on the way down the creek */
  zone: ZoneId;
  /** brand-neutral base colour for fallbacks / chips */
  color: string;
}

export const AVATARS: AvatarInfo[] = [
  { id: 'koala', name: 'Koala', zone: 'bridge', color: '#8d8578' },
  { id: 'kookaburra', name: 'Kookaburra', zone: 'bridge', color: '#6b7a8f' },
  { id: 'echidna', name: 'Echidna', zone: 'bridge', color: '#8a6d4b' },
  { id: 'wombat', name: 'Wombat', zone: 'bridge', color: '#6e5a48' },
  { id: 'platypus', name: 'Platypus', zone: 'bridge', color: '#5b4a3a' },
  { id: 'wallaby', name: 'Wallaby', zone: 'bridge', color: '#9a7b5c' },
  { id: 'kingparrot', name: 'King parrot', zone: 'bridge', color: '#c8313e' },
  { id: 'cockatoo', name: 'Cockatoo', zone: 'bridge', color: '#f2e8c9' },
  { id: 'rosella', name: 'Crimson rosella', zone: 'bridge', color: '#b3263a' },
  { id: 'magpie', name: 'Magpie', zone: 'bridge', color: '#1f2328' },
  { id: 'possum', name: 'Ringtail possum', zone: 'bridge', color: '#7c6f66' },
  { id: 'bluetongue', name: 'Blue-tongue', zone: 'rockpools', color: '#7d8a6a' },
  { id: 'crab', name: 'Shore crab', zone: 'rockpools', color: '#d9643a' },
  { id: 'starfish', name: 'Sea star', zone: 'rockpools', color: '#e07a5f' },
  { id: 'octopus', name: 'Octopus', zone: 'rockpools', color: '#7b4b94' },
  { id: 'seal', name: 'Fur seal', zone: 'beach', color: '#5d6672' },
  { id: 'penguin', name: 'Little penguin', zone: 'beach', color: '#2d3e5f' },
  { id: 'pelican', name: 'Pelican', zone: 'beach', color: '#e8e1d2' },
  { id: 'hoodedplover', name: 'Hooded plover', zone: 'beach', color: '#b7a98f' },
  { id: 'bluebottle', name: 'Bluebottle', zone: 'mouth', color: '#2f6fd1' },
];

export const AVATAR_IDS: AvatarId[] = AVATARS.map((a) => a.id);

export function avatarById(id: AvatarId): AvatarInfo {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}

// ---------------------------------------------------------------------------
// Default game
// ---------------------------------------------------------------------------

/** The seven prompts a fresh room starts with (all approved starters). */
export const DEFAULT_PROMPT_IDS: string[] = [
  's1-deadly-animal',
  's2-vic-country-town',
  's3-aussie-biscuit',
  's5-aussie-slang',
  's6-afl-player',
  's7-melbourne-suburb',
  's8-gor-town',
];

/** Sam's example special answer from the brief. Hosts can add more in setup. */
export const DEFAULT_SPECIAL_ANSWERS: Record<string, string[]> = {
  'l1-freshwater-creek-bakery': ['cream kiss'],
};
