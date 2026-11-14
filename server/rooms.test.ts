import { describe, expect, it } from 'vitest';
import { AVATAR_IDS, TIERS } from '../shared/theme.js';
import { LIMITS, type PromptBank } from '../shared/types.js';
import { Bank } from './bank.js';
import { ANSWER_ALLOWANCE_MS, Room, type Actor } from './room.js';
import { buildHostView, buildPlayerView } from './views.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function open(id: string, text: string, canon: string[], deep: string[] = []): PromptBank {
  return {
    id,
    text,
    type: 'open',
    category: 'starter',
    approved: true,
    answers: canon.map((c, i) => ({
      canonical: c,
      aliases: [c.toLowerCase() + 's'],
      tier: deep.includes(c) ? 'deep' : i < 4 ? 'common' : i < 8 ? 'uncommon' : 'rare',
    })),
  };
}

const PROMPTS: PromptBank[] = [
  open('a1-biscuit', 'Name a classic Aussie biscuit.', ['Tim Tam', 'Anzac', 'Iced VoVo', 'Kingston', 'Monte Carlo', 'Scotch Finger', 'Mint Slice', 'Jatz', 'Gaiety', 'Teddy Bear'], ['Gaiety']),
  open('a2-town', 'Name a Victorian country town.', ['Ballarat', 'Bendigo', 'Geelong', 'Mildura', 'Echuca', 'Bright', 'Lorne', 'Daylesford', 'Nhill', 'Dimboola'], ['Nhill', 'Dimboola']),
  open('a3-animal', 'Name a deadly Australian animal.', ['Brown Snake', 'Shark', 'Crocodile', 'Box Jellyfish', 'Redback', 'Funnel Web', 'Blue Ring', 'Cassowary', 'Stonefish', 'Cone Snail'], ['Cone Snail']),
  open('a4-slang', 'Name an Aussie slang word.', ['Arvo', 'Servo', 'Bottle-o', 'Mate', 'Esky', 'Ute', 'Dunny', 'Durry', 'Furphy', 'Drongo'], ['Furphy']),
  open('a5-suburb', 'Name a Melbourne suburb.', ['St Kilda', 'Richmond', 'Fitzroy', 'Brunswick', 'Footscray', 'Carlton', 'Toorak', 'Frankston', 'Bulleen', 'Keilor'], ['Bulleen']),
  open('a6-gor', 'Name a town on the Great Ocean Road.', ['Lorne', 'Apollo Bay', 'Torquay', 'Anglesea', 'Aireys Inlet', 'Port Campbell', 'Wye River', 'Kennett River', 'Separation Creek', 'Wongarra'], ['Wongarra']),
  {
    id: 'n1-length',
    text: 'How many kilometres long is the Great Ocean Road?',
    type: 'numeric',
    category: 'closest',
    approved: true,
    numeric: { answer: 243, unit: 'km' },
  },
];

const T0 = 1_700_000_000_000;
const HOST: Actor = { kind: 'host' };

function makeRoom(now = T0): Room {
  const bank = Bank.fromPrompts(PROMPTS);
  return new Room({ code: 'TEST', bank, now });
}

function join20(room: Room, now = T0): { id: string; token: string; name: string }[] {
  const out: { id: string; token: string; name: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const name = `Player ${i + 1}`;
    const res = room.join(name, AVATAR_IDS[i]!, now + i);
    if (!res.ok) throw new Error(`join failed: ${res.message}`);
    out.push({ id: res.value.playerId, token: res.value.token, name });
  }
  return out;
}

function expectOk<T>(r: { ok: boolean; code?: string; message?: string; value?: T }): void {
  if (!r.ok) throw new Error(`expected ok, got ${r.code}: ${r.message}`);
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

describe('lobby', () => {
  it('defaults to the first seven approved prompts and 20 second rounds', () => {
    const room = makeRoom();
    expect(room.config.promptIds).toEqual(PROMPTS.map((p) => p.id));
    expect(room.config.secondsPerPrompt).toBe(LIMITS.defaultSecondsPerPrompt);
    expect(room.config.endEarlyWhenAllAnswered).toBe(true);
    expect(room.phase).toBe('lobby');
  });

  it('validates names, avatars and capacity on join', () => {
    const room = makeRoom();
    const players = join20(room);
    expect(room.players.size).toBe(20);

    expect(room.join('player 1', 'koala', T0)).toMatchObject({ ok: false, code: 'name_taken' });
    expect(room.join('   ', 'koala', T0)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.join('A name that is far too long', 'koala', T0)).toMatchObject({ ok: false, code: 'bad_request' });
    // @ts-expect-error – invalid avatar at runtime
    expect(room.join('Twenty-one', 'dragon', T0)).toMatchObject({ ok: false, code: 'bad_request' });
    // every avatar is taken by the 20 players, so latecomers may double up …
    expect(room.join('Twenty-one', 'koala', T0)).toMatchObject({ ok: true });
    expect(room.join('Twenty-two', 'koala', T0)).toMatchObject({ ok: true });
    expect(room.join('Twenty-three', 'crab', T0)).toMatchObject({ ok: true });
    expect(room.join('Twenty-four', 'crab', T0)).toMatchObject({ ok: true });
    // … until the hard cap
    expect(room.players.size).toBe(LIMITS.maxPlayersPerRoom);
    expect(room.join('Twenty-five', 'seal', T0)).toMatchObject({ ok: false, code: 'room_full' });
    // while an avatar is still free, duplicates are refused
    const small = makeRoom();
    expectOk(small.join('A', 'koala', T0));
    expect(small.join('B', 'koala', T0)).toMatchObject({ ok: false, code: 'avatar_taken' });

    // resume by token
    expect(room.resume(players[3]!.token)?.id).toBe(players[3]!.id);
    expect(room.resume('nope')).toBeUndefined();
  });

  it('applies validated config patches only in the lobby', () => {
    const room = makeRoom();
    expectOk(room.configure({ secondsPerPrompt: 30, promptIds: ['a1-biscuit', 'n1-length'], title: 'Sep Creek' }, T0));
    expect(room.config.secondsPerPrompt).toBe(30);
    expect(room.config.promptIds).toEqual(['a1-biscuit', 'n1-length']);
    expect(room.config.title).toBe('Sep Creek');

    expect(room.configure({ secondsPerPrompt: 5 }, T0)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.configure({ promptIds: ['nope'] }, T0)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.configure({ promptIds: ['a1-biscuit', 'a1-biscuit'] }, T0)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.configure({ promptIds: [] }, T0)).toMatchObject({ ok: false, code: 'bad_request' });
    expectOk(room.configure({ specialAnswers: { 'a1-biscuit': ['  Gaiety ', ''] } }, T0));
    expect(room.config.specialAnswers['a1-biscuit']).toEqual(['Gaiety']);

    join20(room);
    expectOk(room.start(T0));
    expect(room.configure({ secondsPerPrompt: 25 }, T0)).toMatchObject({ ok: false, code: 'wrong_phase' });
  });

  it('refuses to start with no players and blocks joins once started', () => {
    const room = makeRoom();
    expect(room.start(T0)).toMatchObject({ ok: false, code: 'bad_request' });
    join20(room);
    expectOk(room.start(T0));
    expect(room.phase).toBe('prompt');
    expect(room.join('Late', 'koala', T0)).toMatchObject({ ok: false, code: 'game_in_progress' });
    expect(room.start(T0)).toMatchObject({ ok: false, code: 'wrong_phase' });
  });

  it('enforces host-only and player-only messages through handle()', () => {
    const room = makeRoom();
    const [p1] = join20(room);
    const player: Actor = { kind: 'player', playerId: p1!.id };
    expect(room.handle(player, { t: 'host:start' }, T0)).toMatchObject({ ok: false, code: 'not_host' });
    expect(room.handle(HOST, { t: 'player:answer', roundIndex: 0, text: 'x' }, T0)).toMatchObject({ ok: false, code: 'not_player' });
    expectOk(room.handle(HOST, { t: 'host:start' }, T0));
    expectOk(room.handle(player, { t: 'player:answer', roundIndex: 0, text: 'Tim Tam' }, T0 + 10));
  });
});

// ---------------------------------------------------------------------------
// A full game
// ---------------------------------------------------------------------------

describe('a full 7-round game with 20 players', () => {
  const room = makeRoom();
  const players = join20(room);
  const byName = new Map(players.map((p) => [p.name, p]));
  let now = T0 + 1_000;

  it('starts round 0 with a 20 s window', () => {
    expectOk(room.start(now));
    expect(room.phase).toBe('prompt');
    const round = room.currentRound!;
    expect(round.index).toBe(0);
    expect(round.promptId).toBe('a1-biscuit');
    expect(round.endsAt).toBe(now + 20_000);
    expect(room.nextDeadline()).toBe(now + 20_000 + ANSWER_ALLOWANCE_MS);
  });

  it('accepts one answer per player and rejects the rest', () => {
    const p1 = players[0]!;
    expectOk(room.answer(p1.id, 0, '  tim   tams ', now + 100));
    expect(room.answer(p1.id, 0, 'Anzac', now + 200)).toMatchObject({ ok: false, code: 'already_answered' });
    expect(room.answer(players[1]!.id, 1, 'Anzac', now + 200)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.answer(players[1]!.id, 0, '   ', now + 200)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.answer('ghost', 0, 'Anzac', now + 200)).toMatchObject({ ok: false, code: 'not_player' });
    expect(room.answer(players[1]!.id, 0, 'Anzac', now + 20_000 + ANSWER_ALLOWANCE_MS + 1)).toMatchObject({ ok: false, code: 'too_late' });
    expect(room.currentRound!.submissions.get(p1.id)?.raw).toBe('tim tams');
  });

  it('bounces answers that are not on the list, and the player can keep trying', () => {
    const p2 = players[1]!;
    expect(room.answer(p2.id, 0, 'Weet-Bix', now + 210)).toMatchObject({ ok: false, code: 'not_in_bank' });
    // nothing was recorded, so a corrected answer still goes through
    expect(room.currentRound!.submissions.has(p2.id)).toBe(false);
    expect(room.answer(p2.id, 0, 'totally made up', now + 220)).toMatchObject({ ok: false, code: 'not_in_bank' });
    // typos within the fuzzy budget still land
    expectOk(room.answer(p2.id, 0, 'Anzak', now + 230));
    expect(room.currentRound!.submissions.get(p2.id)?.raw).toBe('Anzak');
    // undo for the rest of this suite: the scripted round below re-submits everyone
    room.currentRound!.submissions.delete(p2.id);
  });

  it('hides answers from views during the prompt', () => {
    const pv = buildPlayerView(room, players[1]!.id, now)!;
    expect(pv.phase).toBe('prompt');
    expect(pv.round?.groups).toBeUndefined();
    expect(pv.round?.results).toBeUndefined();
    expect(pv.round?.submittedPlayerIds).toEqual([players[0]!.id]);
    expect(pv.me.submission).toBeUndefined();
    const hv = buildHostView(room, [], 'http://x/?code=TEST', now);
    expect(hv.roundHistory).toEqual([]);
    expect(hv.round?.groups).toBeUndefined();
  });

  it('closes early (after the grace period) once everyone connected has answered', () => {
    // 8× Tim Tam, 5× Anzac, 3× Kingston, 2× Jatz, 1× Gaiety (deep), 1× Mint Slice
    const script: Record<string, string> = {};
    const names = players.map((p) => p.name);
    names.slice(1, 8).forEach((n) => (script[n] = 'Tim Tam'));
    names.slice(8, 13).forEach((n) => (script[n] = 'ANZAC'));
    names.slice(13, 16).forEach((n) => (script[n] = 'kingston'));
    names.slice(16, 18).forEach((n) => (script[n] = 'Jatz'));
    script[names[18]!] = 'Gaiety';
    // the last player fumbles a made-up answer first, then lands a real one
    expect(room.answer(byName.get(names[19]!)!.id, 0, 'Weet-Bix', now + 400)).toMatchObject({ ok: false, code: 'not_in_bank' });
    script[names[19]!] = 'Mint Slice';
    for (const [name, text] of Object.entries(script)) {
      expectOk(room.answer(byName.get(name)!.id, 0, text, now + 500));
    }
    expect(room.phase).toBe('prompt');
    expect(room.nextDeadline()).toBe(now + 500 + LIMITS.allAnsweredGraceMs);
    expect(room.tick(now + 500 + LIMITS.allAnsweredGraceMs - 1)).toBe(false);
    expect(room.tick(now + 500 + LIMITS.allAnsweredGraceMs)).toBe(true);
    expect(room.phase).toBe('reveal');
    expect(room.drainEffects()).toEqual([{ type: 'round_closed', roundIndex: 0 }]);
  });

  it('scores the reveal by live rarity', () => {
    const round = room.currentRound!;
    expect(round.validCount).toBe(20);
    const g = Object.fromEntries(round.groups!.map((x) => [x.display, x]));
    expect(g['Tim Tam']!.count).toBe(8);
    expect(g['Tim Tam']!.tier).toBe('puddle');
    expect(g['Anzac']!.tier).toBe('shallows'); // 5/20 = 25 %
    expect(g['Kingston']!.tier).toBe('shallows'); // 3/20 → rockpool, capped: graded 'common'
    expect(g['Jatz']!.tier).toBe('rockpool'); // 2/20
    expect(g['Gaiety']!.tier).toBe('krillion');
    expect(g['Mint Slice']!.status).toBe('bank');
    expect(g['Mint Slice']!.tier).toBe('rockpool'); // unique, but graded 'uncommon' → capped at 60
    expect(room.players.get(byName.get('Player 19')!.id)!.depth).toBe(100);
    expect(room.players.get(byName.get('Player 1')!.id)!.depth).toBe(10);
    const pv = buildPlayerView(room, byName.get('Player 20')!.id, now)!;
    expect(pv.me.result?.tier).toBe('rockpool');
    expect(pv.config.specialAnswers).toEqual({});
    expect(pv.config.promptIds).toEqual([]);
    expect(pv.me.history).toHaveLength(1);
  });

  it('lets the host reject a scored answer and re-scores from the round snapshot', () => {
    const p20 = byName.get('Player 20')!;
    expect(room.moderate(0, 'bank:mint slice', false, now + 3_000)).toMatchObject({ ok: true });
    let round = room.currentRound!;
    expect(round.validCount).toBe(19);
    expect(round.results![p20.id]!.tier).toBe('dry');
    expect(room.players.get(p20.id)!.depth).toBe(0);
    expect(round.groups!.find((g) => g.key === 'bank:mint slice')!.status).toBe('rejected');
    // Anzac is now 5/19 = 26 % → still shallows; Tim Tam 8/19 = 42 % → still puddle
    expect(round.groups!.find((g) => g.display === 'Anzac')!.tier).toBe('shallows');

    // and accept it again — idempotent re-score, back to its capped rock pool
    expect(room.moderate(0, 'bank:mint slice', true, now + 3_100)).toMatchObject({ ok: true });
    round = room.currentRound!;
    expect(round.validCount).toBe(20);
    expect(room.players.get(p20.id)!.depth).toBe(60);

    expect(room.moderate(0, 'bank:nothing', false, now)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.moderate(1, 'bank:mint slice', false, now)).toMatchObject({ ok: false, code: 'wrong_phase' });
  });

  it("lets the host judge any answer — their call is final", () => {
    const p20 = byName.get('Player 20')!;
    // pin Mint Slice (auto: capped rockpool 60) to One in a Krillion
    expect(room.override(0, 'bank:mint slice', 'krillion', now + 3_500)).toMatchObject({ ok: true });
    let g = room.currentRound!.groups!.find((x) => x.key === 'bank:mint slice')!;
    expect(g.tier).toBe('krillion');
    expect(g.overridden).toBe(true);
    expect(room.players.get(p20.id)!.depth).toBe(100);

    // the pin survives re-scores triggered by other moderation
    expect(room.moderate(0, 'bank:jatz', false, now + 3_600)).toMatchObject({ ok: true });
    g = room.currentRound!.groups!.find((x) => x.key === 'bank:mint slice')!;
    expect(g.tier).toBe('krillion');
    expect(room.moderate(0, 'bank:jatz', true, now + 3_650)).toMatchObject({ ok: true });

    // judging a rejected answer puts it back in play at the judged tier
    expect(room.moderate(0, 'bank:mint slice', false, now + 3_700)).toMatchObject({ ok: true });
    expect(room.players.get(p20.id)!.depth).toBe(0);
    expect(room.override(0, 'bank:mint slice', 'shallows', now + 3_800)).toMatchObject({ ok: true });
    expect(room.players.get(p20.id)!.depth).toBe(30);

    // clearing the pin returns to automatic scoring (capped rock pool)
    expect(room.override(0, 'bank:mint slice', null, now + 3_900)).toMatchObject({ ok: true });
    g = room.currentRound!.groups!.find((x) => x.key === 'bank:mint slice')!;
    expect(g.tier).toBe('rockpool');
    expect(g.overridden).toBeUndefined();
    expect(room.players.get(p20.id)!.depth).toBe(60);

    expect(room.override(0, 'bank:nothing', 'puddle', now)).toMatchObject({ ok: false, code: 'bad_request' });
    expect(room.override(1, 'bank:mint slice', 'puddle', now)).toMatchObject({ ok: false, code: 'wrong_phase' });
  });

  it('still vouches legacy unverified answers (rounds recorded before strict validation)', () => {
    const room2 = makeRoom();
    const ps = join20(room2);
    expectOk(room2.start(T0));
    // as if written by an older build or a restored snapshot: bypass answer()
    room2.currentRound!.submissions.set(ps[0]!.id, { raw: 'Weet-Bix', at: T0 + 1 });
    expectOk(room2.answer(ps[1]!.id, 0, 'Tim Tam', T0 + 2));
    expectOk(room2.answer(ps[2]!.id, 0, 'Anzac', T0 + 2));
    expectOk(room2.answer(ps[3]!.id, 0, 'Kingston', T0 + 2));
    expectOk(room2.endRound(T0 + 3));
    const g = room2.currentRound!.groups!.find((x) => x.display === 'Weet-bix')!;
    expect(g.status).toBe('unverified');
    expect(g.tier).toBe('rockpool');
    expectOk(room2.moderate(0, g.key, true, T0 + 4));
    expect(room2.currentRound!.groups!.find((x) => x.key === g.key)!.tier).toBe('deepcut');
  });

  it('special answers cannot be rejected and always score the top tier', () => {
    const room2 = makeRoom();
    const ps = join20(room2);
    expectOk(room2.configure({ specialAnswers: { 'a1-biscuit': ['tim tam'] } }, T0));
    expectOk(room2.start(T0));
    for (const p of ps) expectOk(room2.answer(p.id, 0, 'Tim Tam', T0 + 1));
    expectOk(room2.endRound(T0 + 2));
    const g = room2.currentRound!.groups![0]!;
    expect(g.status).toBe('special');
    expect(g.tier).toBe('krillion');
    expect(room2.moderate(0, g.key, false, T0 + 3)).toMatchObject({ ok: false, code: 'bad_request' });
  });

  it('moves to the next prompt and ignores a disconnected player for early close', () => {
    now += 5_000;
    expectOk(room.next(now));
    expect(room.phase).toBe('prompt');
    expect(room.currentRound!.index).toBe(1);
    const p20 = byName.get('Player 20')!;
    room.setPlayerConnected(p20.id, false, now);
    for (const p of players.slice(0, 19)) expectOk(room.answer(p.id, 1, 'Ballarat', now + 100));
    expect(room.nextDeadline()).toBe(now + 100 + LIMITS.allAnsweredGraceMs);
    expect(room.tick(now + 100 + LIMITS.allAnsweredGraceMs)).toBe(true);
    expect(room.phase).toBe('reveal');
    expect(room.currentRound!.results![p20.id]!.tier).toBe('dry');
    expect(room.currentRound!.groups![0]!.tier).toBe('puddle');
    room.setPlayerConnected(p20.id, true, now);
  });

  it('closes on the hard deadline when nobody answers', () => {
    now += 5_000;
    expectOk(room.next(now));
    expect(room.currentRound!.index).toBe(2);
    expect(room.tick(now + 20_000 + ANSWER_ALLOWANCE_MS - 1)).toBe(false);
    expect(room.tick(now + 20_000 + ANSWER_ALLOWANCE_MS)).toBe(true);
    expect(room.phase).toBe('reveal');
    expect(room.currentRound!.validCount).toBe(0);
    for (const p of players) expect(room.currentRound!.results![p.id]!.tier).toBe('dry');
  });

  it('lets the host end a prompt immediately', () => {
    now += 25_000;
    expectOk(room.next(now));
    expect(room.currentRound!.index).toBe(3);
    expectOk(room.answer(players[0]!.id, 3, 'Furphy', now + 50));
    expectOk(room.answer(players[1]!.id, 3, 'Arvo', now + 60));
    expect(room.endRound(now + 100)).toMatchObject({ ok: true });
    expect(room.endRound(now + 100)).toMatchObject({ ok: false, code: 'wrong_phase' });
    const r = room.currentRound!;
    expect(r.validCount).toBe(2);
    // both unique: Furphy ('deep') holds a deepcut in a tiny room; Arvo is a
    // 'common' everyone knows, so the cap holds it to a schooler
    expect(r.results![players[0]!.id]!.tier).toBe('deepcut');
    expect(r.results![players[1]!.id]!.tier).toBe('shallows');
  });

  it('plays rounds 4 and 5 with typo-tolerant matching', () => {
    now += 2_000;
    expectOk(room.next(now));
    for (const p of players.slice(0, 10)) expectOk(room.answer(p.id, 4, 'Footscray', now + 10));
    for (const p of players.slice(10, 20)) expectOk(room.answer(p.id, 4, 'Footscary', now + 10)); // typo
    expectOk(room.endRound(now + 500));
    expect(room.currentRound!.groups).toHaveLength(1);
    expect(room.currentRound!.groups![0]!.count).toBe(20);

    now += 2_000;
    expectOk(room.next(now));
    // not an alias in this fixture → bounced; the player tries again with a real one
    expect(room.answer(players[0]!.id, 5, 'Sep Creek', now + 10)).toMatchObject({ ok: false, code: 'not_in_bank' });
    expectOk(room.answer(players[0]!.id, 5, 'Wye River', now + 12));
    expectOk(room.answer(players[1]!.id, 5, 'Separation Creeks', now + 10)); // plural alias → bank
    for (const p of players.slice(2)) expectOk(room.answer(p.id, 5, 'Lorne', now + 10));
    expectOk(room.endRound(now + 500));
    const g = Object.fromEntries(room.currentRound!.groups!.map((x) => [x.display, x]));
    expect(g['Separation Creek']!.status).toBe('bank');
    expect(g['Separation Creek']!.bankTier).toBe('rare');
    expect(g['Separation Creek']!.tier).toBe('deepcut'); // unique, graded 'rare' → cap is exactly a deep cut
    expect(g['Wye River']!.tier).toBe('rockpool'); // unique, but graded 'uncommon' → capped at 60
  });

  it('scores the numeric closest-to-the-pin round by rank', () => {
    now += 2_000;
    expectOk(room.next(now));
    const r = room.currentRound!;
    expect(r.promptId).toBe('n1-length');
    // 'dunno' is not a number: bounced at submit, that player sits the round out
    expect(room.answer(players[7]!.id, 6, 'dunno', now + 5)).toMatchObject({ ok: false, code: 'not_in_bank' });
    const guesses = ['243', '240 km', '250', '236', '300', '100', 'about 1,000'];
    players.forEach((p, i) => {
      const g = guesses[i];
      if (g) expectOk(room.answer(p.id, 6, g, now + 10));
    });
    expectOk(room.endRound(now + 500));
    expect(room.phase).toBe('reveal');
    expect(r.numericAnswer?.answer).toBe(243);
    expect(r.validCount).toBe(7);
    expect(r.results![players[0]!.id]!.tier).toBe('krillion');
    expect(r.results![players[1]!.id]!.tier).toBe('deepcut');
    expect(r.results![players[2]!.id]!.numeric?.rank).toBe(3);
    expect(r.results![players[3]!.id]!.numeric?.rank).toBe(3);
    expect(r.results![players[7]!.id]!.tier).toBe('dry');
    expect(r.results![players[19]!.id]!.tier).toBe('dry');
  });

  it('finishes with consistent depths and history', () => {
    now += 2_000;
    expectOk(room.next(now));
    expect(room.phase).toBe('results');
    expect(room.finishedAt).toBe(now);
    expect(room.next(now)).toMatchObject({ ok: false, code: 'wrong_phase' });
    expect(room.nextDeadline()).toBeNull();
    const hv = buildHostView(room, [], 'http://x/?code=TEST', now);
    expect(hv.roundHistory).toHaveLength(7);
    for (const p of players) {
      const pv = buildPlayerView(room, p.id, now)!;
      expect(pv.me.history).toHaveLength(7);
      const sum = pv.me.history.reduce((n, h) => n + h.points, 0);
      expect(room.players.get(p.id)!.depth).toBe(sum);
      for (const h of pv.me.history) expect(h.points).toBe(TIERS[h.tier].points);
      for (let i = 1; i < pv.me.history.length; i++) {
        expect(pv.me.history[i]!.depthAfter).toBeGreaterThanOrEqual(pv.me.history[i - 1]!.depthAfter);
      }
    }
  });

  it('round-trips through a snapshot', () => {
    const snap = JSON.parse(JSON.stringify(room.snapshot()));
    const copy = Room.fromSnapshot(snap, Bank.fromPrompts(PROMPTS), now + 1);
    expect(copy.phase).toBe('results');
    expect(copy.players.size).toBe(20);
    expect([...copy.players.values()].every((p) => !p.connected)).toBe(true);
    expect(copy.rounds).toHaveLength(7);
    expect(copy.currentRound!.results![players[0]!.id]!.depthAfter).toBe(room.players.get(players[0]!.id)!.depth);
    expect(copy.hostToken).toBe(room.hostToken);
  });

  it('restarts into the lobby with depths reset, and kicks players', () => {
    expectOk(room.restart(now));
    expect(room.phase).toBe('lobby');
    expect(room.rounds).toHaveLength(0);
    for (const p of room.players.values()) {
      expect(p.depth).toBe(0);
      expect(p.lastTier).toBeUndefined();
    }
    const victim = players[5]!;
    room.drainEffects(); // the manager drains after every commit; this test never did
    expectOk(room.kick(victim.id, now));
    expect(room.players.has(victim.id)).toBe(false);
    expect(room.drainEffects()).toEqual([{ type: 'kicked', playerId: victim.id }]);
    expect(room.kick(victim.id, now)).toMatchObject({ ok: false, code: 'bad_request' });
    // the freed avatar can be reused
    expectOk(room.join('Newcomer', AVATAR_IDS[5]!, now));
  });
});

describe('snapshot restore of an open prompt', () => {
  it('closes a round whose deadline passed while the server was down', () => {
    const room = makeRoom();
    const ps = join20(room);
    expectOk(room.start(T0));
    expectOk(room.answer(ps[0]!.id, 0, 'Tim Tam', T0 + 10));
    const snap = JSON.parse(JSON.stringify(room.snapshot()));
    const later = Room.fromSnapshot(snap, Bank.fromPrompts(PROMPTS), T0 + 60_000);
    expect(later.phase).toBe('reveal');
    // lone answer, but 'Tim Tam' is graded 'common': capped at a schooler
    expect(later.currentRound!.results![ps[0]!.id]!.tier).toBe('shallows');
  });

  it('keeps a round open when its deadline is still ahead', () => {
    const room = makeRoom();
    join20(room);
    expectOk(room.start(T0));
    const snap = JSON.parse(JSON.stringify(room.snapshot()));
    const later = Room.fromSnapshot(snap, Bank.fromPrompts(PROMPTS), T0 + 5_000);
    expect(later.phase).toBe('prompt');
    expect(later.nextDeadline()).toBe(T0 + 20_000 + ANSWER_ALLOWANCE_MS);
  });
});

// ---------------------------------------------------------------------------
// Review fixes
// ---------------------------------------------------------------------------

describe('review fixes', () => {
  it('gives a reconnecting straggler their time back', () => {
    const room = makeRoom();
    const players = join20(room);
    expectOk(room.start(T0));
    for (const p of players.slice(0, 19)) expectOk(room.answer(p.id, 0, 'Tim Tam', T0 + 1000));
    room.setPlayerConnected(players[19]!.id, false, T0 + 2000);
    expect(room.currentRound!.closeAt).toBeDefined();
    room.setPlayerConnected(players[19]!.id, true, T0 + 2300);
    expect(room.currentRound!.closeAt).toBeUndefined();
    room.tick(T0 + 4000);
    expect(room.phase).toBe('prompt');
    expectOk(room.answer(players[19]!.id, 0, 'Gaiety', T0 + 5000));
    room.tick(T0 + 5000 + 1200);
    expect(room.phase).toBe('reveal');
  });

  it('re-scores an open reveal when a player is kicked', () => {
    const room = makeRoom();
    const players = join20(room);
    expectOk(room.start(T0));
    const rest = ['Anzac', 'Iced VoVo', 'Kingston', 'Monte Carlo', 'Scotch Finger', 'Mint Slice', 'Jatz', 'Gaiety', 'Teddy Bear'];
    players.forEach((p, i) => expectOk(room.answer(p.id, 0, i < 7 ? 'Tim Tam' : rest[(i - 7) % rest.length]!, T0 + 1000)));
    room.tick(T0 + 3000);
    expect(room.phase).toBe('reveal');
    const before = room.currentRound!.groups!.find((g) => g.display === 'Tim Tam')!;
    expect(before.tier).toBe('puddle'); // 7 of 20 = 35 %
    for (const p of players.slice(17)) expectOk(room.kick(p.id, T0 + 4000));
    const after = room.currentRound!.groups!.find((g) => g.display === 'Tim Tam')!;
    expect(room.currentRound!.validCount).toBe(17);
    expect(after.tier).toBe('puddle'); // 7 of 17
    expect(after.playerIds).toHaveLength(7);
    expect(room.currentRound!.groups!.every((g) => g.playerIds.every((id) => room.players.has(id)))).toBe(true);
    expect(room.players.get(players[0]!.id)!.depth).toBe(10);
  });

  it('strips control and zero-width characters from names and answers', () => {
    const room = makeRoom();
    const joined = room.join('Sam\u0000​', 'koala', T0);
    expectOk(joined);
    if (!joined.ok) throw new Error('unreachable');
    expect(room.players.get(joined.value.playerId)!.name).toBe('Sam');
    expect(room.join('​​', 'crab', T0)).toMatchObject({ ok: false, code: 'bad_request' });
    expectOk(room.start(T0));
    expect(room.answer(joined.value.playerId, 0, '\u0000 ​', T0 + 500)).toMatchObject({ ok: false, code: 'bad_request' });
  });

  it('applies the valid parts of a creation config even when one field is bad', () => {
    const room = new Room({ code: 'TEST', bank: makeRoom().bank, now: T0, config: { secondsPerPrompt: 45, promptIds: ['nope'] } });
    expect(room.config.secondsPerPrompt).toBe(45);
    expect(room.config.promptIds.length).toBeGreaterThan(0);
  });
});
