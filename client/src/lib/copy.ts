import type { TierId } from '@shared/types';
import { zoneForDepth } from '@shared/theme';

/** Playful one-liners for the phone reveal, a few per tier so rounds don't repeat. */
const LINES: Record<TierId, string[]> = {
  dry: [
    'High and dry. The creek will still be here next round.',
    'No answer, no dive. Shake the sand off and go again.',
    'The bridge is lovely this time of year. Stay a while.',
  ],
  puddle: [
    'Barely got your feet wet.',
    'That’s a puddle, not a dive. Half the room said it.',
    'Ankle deep. The tannin water is nice and warm, at least.',
    'Everyone had that one. Splash.',
  ],
  shallows: [
    'Shin deep. A few mates had the same idea.',
    'A modest plunge into the shallows.',
    'Not bad. You can still see the bridge from here.',
    'A couple of others went there too. Into the shallows you go.',
  ],
  rockpool: [
    'Into the rock pools. Mind the anemones.',
    'Only a couple of you went there. Crab country.',
    'Rock pool! Watch your footing on the basalt.',
    'Nicely done. The sea stars approve.',
  ],
  deepcut: [
    'A deep cut! Nobody else went near it.',
    'Only you. Straight past the surf.',
    'That one’s yours alone. Down you go.',
    'Unique in the room. The kelp waves you through.',
  ],
  krillion: [
    'ONE IN A KRILLION. Headfirst into the trench.',
    'The creek mouth is calling. Legend.',
    'Unique, and a true deep cut. Bass Strait, here we come.',
    'Nobody saw that coming. Bioluminescence all round.',
  ],
};

/** Deterministic pick so every phone shows the same line for the same round. */
export function diveLine(tier: TierId, roundIndex: number, seed = 0): string {
  const lines = LINES[tier];
  return lines[(roundIndex + seed) % lines.length] ?? lines[0]!;
}

/** A callout when this round's drop crosses into a new zone, else null. */
export function zoneCrossing(depthBefore: number, depthAfter: number): string | null {
  const before = zoneForDepth(depthBefore);
  const after = zoneForDepth(depthAfter);
  if (depthAfter <= depthBefore || before.id === after.id) return null;
  switch (after.id) {
    case 'rockpools':
      return 'You’ve reached the rock pools!';
    case 'beach':
      return 'Out onto the beach!';
    case 'mouth':
      return 'You’ve made it to the creek mouth!';
    default:
      return null;
  }
}
