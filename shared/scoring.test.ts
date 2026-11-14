import { describe, expect, it } from 'vitest';
import {
  buildMatcher,
  editDistance,
  normalizeAnswer,
  parseNumber,
  scoreNumericRound,
  scoreOpenRound,
  singularizePhrase,
  tierForRarity,
} from './scoring.js';
import type { PromptBank } from './types.js';

const biscuits: PromptBank = {
  id: 'test-biscuits',
  text: 'Name a classic Aussie biscuit.',
  type: 'open',
  category: 'starter',
  approved: true,
  answers: [
    { canonical: 'Tim Tam', aliases: ['tim tams', 'timtam', 'timtams'], tier: 'common' },
    { canonical: 'Anzac biscuit', aliases: ['anzac', 'anzacs', 'anzac bikkie'], tier: 'common' },
    { canonical: 'Iced VoVo', aliases: ['iced vo vo', 'vovo', 'vo vo'], tier: 'uncommon' },
    { canonical: 'Kingston', aliases: ['kingstons'], tier: 'uncommon' },
    { canonical: 'Monte Carlo', aliases: ['monte carlos'], tier: 'uncommon' },
    { canonical: 'Scotch Finger', aliases: ['scotch fingers'], tier: 'common' },
    { canonical: 'Gaiety', aliases: ['gaieties', 'gaietys'], tier: 'deep' },
    { canonical: 'Teddy Bear biscuit', aliases: ['teddy bear', 'teddy bears'], tier: 'rare' },
    // The biscuit sitting on the table in front of everyone.
    { canonical: 'Butternut Snap', aliases: ['butternut snaps', 'butternut'], tier: 'common', obvious: true },
  ],
};

describe('normalizeAnswer', () => {
  it('lowercases, strips punctuation and leading articles', () => {
    expect(normalizeAnswer('  The Twelve Apostles! ')).toBe('twelve apostles');
    expect(normalizeAnswer("Arnott's Tim-Tam")).toBe('arnotts tim tam');
    expect(normalizeAnswer('Café Crème')).toBe('cafe creme');
    expect(normalizeAnswer('Fish & Chips')).toBe('fish and chips');
  });
  it('returns empty for blank input', () => {
    expect(normalizeAnswer('   ')).toBe('');
    expect(normalizeAnswer('!!!')).toBe('');
  });
});

describe('singularizePhrase', () => {
  it('handles common plurals without mangling short words', () => {
    expect(singularizePhrase('tim tams')).toBe('tim tam');
    expect(singularizePhrase('kookaburras')).toBe('kookaburra');
    expect(singularizePhrase('bus')).toBe('bus');
    expect(singularizePhrase('beaches')).toBe('beach');
    // -y and -ies share one key, so lolly/lollies and mozzie/mozzies each group
    expect(singularizePhrase('lollies')).toBe(singularizePhrase('lolly'));
    expect(singularizePhrase('mozzies')).toBe(singularizePhrase('mozzie'));
  });
  it('folds place-name abbreviations', () => {
    expect(normalizeAnswer('Mount Eliza')).toBe(normalizeAnswer('Mt Eliza'));
    expect(normalizeAnswer('Saint Kilda')).toBe(normalizeAnswer('St. Kilda'));
    expect(normalizeAnswer('North Melbourne')).toBe(normalizeAnswer('Nth Melbourne'));
  });
});

describe('editDistance', () => {
  it('counts transpositions as one edit', () => {
    expect(editDistance('timtam', 'tmitam')).toBe(1);
    expect(editDistance('kingston', 'kingstn')).toBe(1);
    expect(editDistance('abc', 'xyz')).toBe(3);
  });
});

describe('buildMatcher', () => {
  const m = buildMatcher(biscuits);
  it('matches canonicals and aliases exactly', () => {
    expect(m.match('Tim Tams')?.display).toBe('Tim Tam');
    expect(m.match('ANZAC')?.display).toBe('Anzac biscuit');
    expect(m.match('iced vo vo')?.display).toBe('Iced VoVo');
  });
  it('matches plurals and small typos', () => {
    expect(m.match('Kingstons')?.display).toBe('Kingston');
    expect(m.match('Monte Carlos')?.display).toBe('Monte Carlo');
    expect(m.match('Scoch Finger')?.display).toBe('Scotch Finger');
    expect(m.match('Scotch Finger')?.via).toBe('exact');
  });
  it('does not fuzzy-match very short strings', () => {
    expect(m.match('tam')?.matched).toBe(false);
  });
  it('refuses to guess when a typo is within reach of two different entries', () => {
    const towns = buildMatcher({
      answers: [
        { canonical: 'Ballan', aliases: ['balan'], tier: 'rare' },
        { canonical: 'Wallan', aliases: [], tier: 'rare' },
        { canonical: 'Terang', aliases: [], tier: 'rare' },
      ],
    });
    expect(towns.match('walan')?.matched).toBe(false); // Ballan or Wallan? neither
    expect(towns.match('terrang')?.display).toBe('Terang'); // only one in range
  });
  it('treats a form two entries both claim as unverified', () => {
    const afl = buildMatcher({
      answers: [
        { canonical: 'Joel Selwood', aliases: ['selwood'], tier: 'common' },
        { canonical: 'Adam Selwood', aliases: ['selwood'], tier: 'rare' },
      ],
    });
    expect(afl.match('selwood')?.matched).toBe(false);
    expect(afl.match('joel selwood')?.display).toBe('Joel Selwood');
  });
  it('forgives missing spaces and the kind of typos people make on a phone', () => {
    const towns = buildMatcher({
      answers: [
        { canonical: 'Apollo Bay', aliases: ['apollo'], tier: 'common' },
        { canonical: 'Torquay', aliases: [], tier: 'common' },
        { canonical: 'Korumburra', aliases: [], tier: 'rare' },
        { canonical: 'Aireys Inlet', aliases: ['aireys'], tier: 'common' },
        { canonical: 'Separation Creek', aliases: ['sep creek'], tier: 'rare' },
      ],
    });
    expect(towns.match('apollobay')?.display).toBe('Apollo Bay');
    expect(towns.match('Appolo Bay')?.display).toBe('Apollo Bay');
    expect(towns.match('apolo  bay')?.display).toBe('Apollo Bay');
    expect(towns.match('Torkay')?.display).toBe('Torquay');
    expect(towns.match('torqay')?.display).toBe('Torquay');
    expect(towns.match('Koorumbura')?.display).toBe('Korumburra');
    expect(towns.match("Airey's Inlett")?.display).toBe('Aireys Inlet');
    expect(towns.match('Seperation Ck')?.display).toBe('Separation Creek');
    expect(towns.match('sepcreek')?.display).toBe('Separation Creek');
    // but not a different word entirely
    expect(towns.match('Lorne')?.matched).toBe(false);
  });
  it('can be asked not to fuzzy-match (used for special answers)', () => {
    expect(m.match('Scoch Finger')?.matched).toBe(true);
    expect(m.match('Scoch Finger', { fuzzy: false })?.matched).toBe(false);
  });
  it('groups unknown answers by normalised text', () => {
    const a = m.match('Yo-Yo biscuits');
    const b = m.match('yoyo biscuit');
    expect(a?.matched).toBe(false);
    expect(a?.key).toBe('free:yo yo biscuit');
    expect(b?.key).toBe('free:yoyo biscuit');
  });
  it('returns null for blank', () => {
    expect(m.match('   ')).toBeNull();
  });
});

describe('tierForRarity', () => {
  it('maps live rarity to tiers for a room of 20', () => {
    expect(tierForRarity({ count: 10, validCount: 20 })).toBe('puddle');
    expect(tierForRarity({ count: 6, validCount: 20 })).toBe('puddle'); // 30 %: the obvious answer barely counts
    expect(tierForRarity({ count: 5, validCount: 20 })).toBe('shallows');
    expect(tierForRarity({ count: 4, validCount: 20 })).toBe('shallows');
    expect(tierForRarity({ count: 3, validCount: 20 })).toBe('rockpool');
    expect(tierForRarity({ count: 2, validCount: 20 })).toBe('rockpool');
    expect(tierForRarity({ count: 1, validCount: 20 })).toBe('deepcut');
    expect(tierForRarity({ count: 1, validCount: 20, bankTier: 'deep' })).toBe('krillion');
  });
  it('holds back unknown lone answers until the host vouches', () => {
    expect(tierForRarity({ count: 1, validCount: 20, unverified: true })).toBe('rockpool');
    expect(tierForRarity({ count: 1, validCount: 20, unverified: true, vouched: true })).toBe('deepcut');
    // two people independently typing the same unknown answer is evidence enough
    expect(tierForRarity({ count: 2, validCount: 20, unverified: true })).toBe('rockpool');
  });
  it('special answers always hit the top tier', () => {
    expect(tierForRarity({ count: 15, validCount: 20, special: true })).toBe('krillion');
  });
  it('caps a bank answer at its rarity grade, however few say it', () => {
    expect(tierForRarity({ count: 1, validCount: 20, bankTier: 'common' })).toBe('shallows');
    expect(tierForRarity({ count: 1, validCount: 20, bankTier: 'uncommon' })).toBe('rockpool');
    expect(tierForRarity({ count: 1, validCount: 20, bankTier: 'rare' })).toBe('deepcut');
    // the crowd can still drag a graded answer below its cap…
    expect(tierForRarity({ count: 8, validCount: 20, bankTier: 'rare' })).toBe('puddle');
    // …and the cap still bites when only a few say a well-known answer
    expect(tierForRarity({ count: 3, validCount: 20, bankTier: 'common' })).toBe('shallows');
    // unverified answers are never capped (legacy rounds only)
    expect(tierForRarity({ count: 1, validCount: 20, unverified: true, vouched: true })).toBe('deepcut');
  });
  it('pins obvious answers to a puddle, even when only one person says them', () => {
    expect(tierForRarity({ count: 1, validCount: 20, bankTier: 'common', obvious: true })).toBe('puddle');
    expect(tierForRarity({ count: 1, validCount: 20, bankTier: 'deep', obvious: true })).toBe('puddle');
    expect(tierForRarity({ count: 2, validCount: 6, obvious: true })).toBe('puddle');
    // a host special answer still trumps the obvious flag
    expect(tierForRarity({ count: 1, validCount: 20, obvious: true, special: true })).toBe('krillion');
  });
  it('is cautious in tiny rooms', () => {
    expect(tierForRarity({ count: 1, validCount: 3, bankTier: 'deep' })).toBe('deepcut');
    expect(tierForRarity({ count: 2, validCount: 3 })).toBe('puddle');
    expect(tierForRarity({ count: 2, validCount: 6 })).toBe('shallows');
    expect(tierForRarity({ count: 2, validCount: 8 })).toBe('rockpool');
  });
  it('scores nothing for nothing', () => {
    expect(tierForRarity({ count: 0, validCount: 10 })).toBe('dry');
  });
});

describe('scoreOpenRound', () => {
  const matcher = buildMatcher(biscuits);
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
  const depthBefore = Object.fromEntries(players.map((p) => [p, 100]));

  it('groups aliases, scores by rarity and carries depth forward', () => {
    const out = scoreOpenRound(
      [
        { playerId: 'p1', raw: 'Tim Tam' },
        { playerId: 'p2', raw: 'tim tams' },
        { playerId: 'p3', raw: 'TIMTAM' },
        { playerId: 'p4', raw: 'Tim Tam' },
        { playerId: 'p5', raw: 'Anzac' },
        { playerId: 'p6', raw: 'anzac biscuits' },
        { playerId: 'p7', raw: 'Kingston' },
        { playerId: 'p8', raw: 'Gaiety' },
        { playerId: 'p9', raw: 'Yo-Yo' },
        // p10 never answered
      ],
      { matcher, depthBefore, playerIds: players },
    );
    expect(out.validCount).toBe(9);
    const byKey = Object.fromEntries(out.groups.map((g) => [g.display, g]));
    expect(byKey['Tim Tam']!.count).toBe(4);
    expect(byKey['Tim Tam']!.tier).toBe('puddle'); // 4/9 = 44 %
    expect(byKey['Anzac biscuit']!.tier).toBe('shallows'); // two of nine → rockpool, capped: it's a 'common'
    expect(byKey['Kingston']!.tier).toBe('rockpool'); // alone, but graded 'uncommon' → capped at 60
    expect(byKey['Gaiety']!.tier).toBe('krillion');
    expect(byKey['Yo-yo']!.status).toBe('unverified');
    expect(byKey['Yo-yo']!.tier).toBe('rockpool'); // unknown and alone: 60 until the host vouches
    expect(out.results['p10']!.tier).toBe('dry');
    expect(out.results['p10']!.depthAfter).toBe(100);
    expect(out.results['p8']!.depthAfter).toBe(200);
    expect(out.results['p1']!.depthAfter).toBe(110);
    // rarest first
    expect(out.groups[0]!.display).toBe('Gaiety');
  });

  it('pins a lone obvious bank answer to a puddle and tags the group', () => {
    const out = scoreOpenRound(
      [
        { playerId: 'p1', raw: 'butternut snap' },
        { playerId: 'p2', raw: 'Gaiety' },
        { playerId: 'p3', raw: 'Kingston' },
        { playerId: 'p4', raw: 'Monte Carlo' },
      ],
      { matcher, depthBefore, playerIds: ['p1', 'p2', 'p3', 'p4'] },
    );
    const snap = out.groups.find((g) => g.display === 'Butternut Snap')!;
    expect(snap.obvious).toBe(true);
    expect(snap.tier).toBe('puddle'); // alone, but it was on the table in front of everyone
    expect(out.results['p1']!.points).toBe(10);
    expect(out.groups.find((g) => g.display === 'Gaiety')!.tier).toBe('krillion'); // untouched
  });

  it('honours host rejections and recomputes the denominator', () => {
    const out = scoreOpenRound(
      [
        { playerId: 'p1', raw: 'Tim Tam' },
        { playerId: 'p2', raw: 'Tim Tam' },
        { playerId: 'p3', raw: 'Weet-Bix' },
        { playerId: 'p4', raw: 'Kingston' },
      ],
      {
        matcher,
        depthBefore,
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        rejectedKeys: new Set(['free:weet bix']),
      },
    );
    expect(out.validCount).toBe(3);
    expect(out.results['p3']!.tier).toBe('dry');
    expect(out.results['p3']!.points).toBe(0);
    const tt = out.groups.find((g) => g.display === 'Tim Tam')!;
    expect(tt.tier).toBe('puddle'); // 2/3
  });

  it('lifts a vouched unknown answer to a deep cut', () => {
    const out = scoreOpenRound(
      [
        { playerId: 'p1', raw: 'Tim Tam' },
        { playerId: 'p2', raw: 'Tim Tam' },
        { playerId: 'p3', raw: 'Tim Tam' },
        { playerId: 'p4', raw: 'Tim Tam' },
        { playerId: 'p5', raw: 'Yo-Yo' },
      ],
      {
        matcher,
        depthBefore,
        playerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        acceptedKeys: new Set(['free:yo yo']),
      },
    );
    const yoyo = out.groups.find((g) => g.display === 'Yo-yo')!;
    expect(yoyo.vouched).toBe(true);
    expect(yoyo.tier).toBe('deepcut');
  });

  it('does not let a mistyped special answer promote a common group', () => {
    const out = scoreOpenRound(
      [
        { playerId: 'p1', raw: 'Tim Tam' },
        { playerId: 'p2', raw: 'Tim Tam' },
        { playerId: 'p3', raw: 'Tim Tam' },
        { playerId: 'p4', raw: 'Anzac' },
      ],
      {
        matcher,
        depthBefore,
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        specialAnswers: ['Tim Tamm'],
      },
    );
    expect(out.groups.find((g) => g.display === 'Tim Tam')!.status).toBe('bank');
  });

  it('special answers score the top tier even when common', () => {
    const out = scoreOpenRound(
      [
        { playerId: 'p1', raw: 'Tim Tam' },
        { playerId: 'p2', raw: 'tim tams' },
        { playerId: 'p3', raw: 'Tim Tam' },
        { playerId: 'p4', raw: 'Anzac' },
      ],
      {
        matcher,
        depthBefore,
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        specialAnswers: ['Tim Tams'],
      },
    );
    const tt = out.groups.find((g) => g.display === 'Tim Tam')!;
    expect(tt.status).toBe('special');
    expect(tt.tier).toBe('krillion');
    expect(out.results['p1']!.points).toBe(100);
  });
});

describe('numeric prompts', () => {
  it('parses messy numbers', () => {
    expect(parseNumber('243')).toBe(243);
    expect(parseNumber('243 km')).toBe(243);
    expect(parseNumber('250 k')).toBe(250); // kilometres, not thousands
    expect(parseNumber('about 1,200 people')).toBe(1200);
    expect(parseNumber('70 000')).toBe(70000);
    expect(parseNumber('2.5k')).toBe(2500);
    expect(parseNumber('3 thousand')).toBe(3000);
    expect(parseNumber('eighteen')).toBe(18);
    expect(parseNumber('about thirty')).toBe(30);
    expect(parseNumber('two hundred and fifty')).toBe(250);
    expect(parseNumber('a hundred')).toBe(100);
    expect(parseNumber('dunno')).toBeNull();
  });

  it('ranks closest to the pin with shared ranks on ties', () => {
    const out = scoreNumericRound(
      [
        { playerId: 'a', raw: '240' },
        { playerId: 'b', raw: '250' },
        { playerId: 'c', raw: '236' }, // tie with b at distance 7
        { playerId: 'd', raw: '100' },
        { playerId: 'e', raw: '9000' },
        { playerId: 'f', raw: 'no idea' },
      ],
      243,
      { depthBefore: {}, playerIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
    );
    expect(out.validCount).toBe(5);
    expect(out.results['a']!.tier).toBe('krillion');
    expect(out.results['b']!.numeric?.rank).toBe(2);
    expect(out.results['c']!.numeric?.rank).toBe(2);
    expect(out.results['b']!.tier).toBe('deepcut');
    expect(out.results['c']!.tier).toBe('deepcut');
    expect(out.results['d']!.numeric?.rank).toBe(4);
    expect(out.results['d']!.tier).toBe('puddle');
    expect(out.results['e']!.tier).toBe('puddle');
    expect(out.results['f']!.tier).toBe('dry');
    expect(out.results['g']!.tier).toBe('dry');
  });
});
