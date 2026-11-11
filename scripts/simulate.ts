/**
 * Drives a whole game against a running server with N bot players.
 *
 *   npm run simulate -- [ws://localhost:8787/ws] [players=20] [flags]
 *
 * Flags:
 *   --seconds=N          timer per prompt (default 12 for a quick run)
 *   --prompts=a,b,c      prompt ids to play (default: the room's defaults)
 *   --pause-at=PHASE     stop advancing at lobby | prompt | reveal (for screenshots)
 *   --keep-open          stay connected in 'results' instead of exiting
 *   --pin=XXXX           host PIN if the server has HOST_PIN set
 *
 * The first stdout line is JSON: {"code","hostToken","joinUrl"} so other tools
 * can attach a browser to the same room. Exits 0 when every invariant held.
 */
import WebSocket from 'ws';
import { Bank } from '../server/bank.js';
import { BANK_DIR } from '../server/paths.js';
import { AVATAR_IDS, TIERS } from '../shared/theme.js';
import type { ClientMessage, HostView, PlayerView, PromptBank, ServerMessage } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=', 2);
      return [k!, v ?? 'true'] as const;
    }),
);
const WS_URL = positional[0] ?? 'ws://localhost:8787/ws';
const PLAYERS = Math.min(AVATAR_IDS.length, Math.max(1, Number.parseInt(positional[1] ?? '20', 10) || 20));
const PAUSE_AT = flags.get('pause-at');
const KEEP_OPEN = flags.has('keep-open');
const SECONDS = Number.parseInt(flags.get('seconds') ?? (PAUSE_AT === 'prompt' ? '60' : '12'), 10);
const PROMPTS = flags.get('prompts')?.split(',').filter(Boolean);
const PIN = flags.get('pin');

const NAMES = [
  'Sam', 'Grandma', 'Tegan', 'Marcus', 'Pia', 'Jonno', 'Lou', 'Harriet', 'Dec', 'Bron',
  'Kel', 'Ollie', 'Nadia', 'Tom', 'Ruby', 'Hamish', 'Zoe', 'Finn', 'Mia', 'Baz', 'Elle', 'Nico', 'Tash', 'Ro',
];

const bank = Bank.load(BANK_DIR());

// ---------------------------------------------------------------------------
// Socket helper
// ---------------------------------------------------------------------------

class Sock {
  readonly ws: WebSocket;
  private readonly listeners = new Set<(m: ServerMessage) => void>();
  readonly label: string;

  constructor(label: string) {
    this.label = label;
    this.ws = new WebSocket(WS_URL);
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (msg.t === 'state') this.latest = msg;
      for (const l of [...this.listeners]) l(msg);
    });
    this.ws.on('error', (e) => fail(`${label}: socket error ${e.message}`));
  }

  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  on(fn: (m: ServerMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Most recent message that satisfied nothing in particular — lets waiters check "already happened". */
  latest?: ServerMessage;

  waitFor<T extends ServerMessage>(pred: (m: ServerMessage) => m is T, timeoutMs?: number): Promise<T>;
  waitFor(pred: (m: ServerMessage) => boolean, timeoutMs?: number): Promise<ServerMessage>;
  waitFor(pred: (m: ServerMessage) => boolean, timeoutMs = 10_000): Promise<ServerMessage> {
    // A state frame that already arrived may already satisfy the predicate.
    if (this.latest && this.latest.t === 'state' && pred(this.latest)) return Promise.resolve(this.latest);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`${this.label}: timed out waiting for message`));
      }, timeoutMs);
      const off = this.on((m) => {
        if (m.t === 'error') {
          clearTimeout(timer);
          off();
          reject(new Error(`${this.label}: ${m.code} ${m.message}`));
          return;
        }
        if (pred(m)) {
          clearTimeout(timer);
          off();
          resolve(m);
        }
      });
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

const isState = (m: ServerMessage): m is Extract<ServerMessage, { t: 'state' }> => m.t === 'state';

// ---------------------------------------------------------------------------
// Bot behaviour
// ---------------------------------------------------------------------------

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function typo(s: string): string {
  if (s.length < 6) return s;
  const i = 1 + Math.floor(Math.random() * (s.length - 3));
  return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
}

/** Picks what a bot types: biased to common answers, with aliases, typos, blanks and made-up answers. */
function pickAnswer(prompt: PromptBank | undefined, botIndex: number): string | null {
  const r = Math.random();
  if (r < 0.05) return null; // never answers
  if (r < 0.1) return `Thingo ${botIndex}`; // made-up → unverified
  if (!prompt) return 'Something';
  if (prompt.type === 'numeric' && prompt.numeric) {
    const a = prompt.numeric.answer;
    const spread = Math.max(1, Math.abs(a)) * (0.05 + Math.random() * 0.8);
    const guess = Math.max(0, Math.round(a + (Math.random() - 0.5) * 2 * spread));
    return Math.random() < 0.3 ? `${guess} ${prompt.numeric.unit ?? ''}`.trim() : String(guess);
  }
  const answers = prompt.answers ?? [];
  if (answers.length === 0) return 'Something';
  const tierRoll = Math.random();
  const want = tierRoll < 0.6 ? 'common' : tierRoll < 0.85 ? 'uncommon' : tierRoll < 0.95 ? 'rare' : 'deep';
  const pool = answers.filter((x) => x.tier === want);
  const entry = rand(pool.length ? pool : answers);
  let text = entry.canonical;
  if (entry.aliases.length && Math.random() < 0.35) text = rand(entry.aliases);
  if (Math.random() < 0.1) text = typo(text);
  if (Math.random() < 0.3) text = text.toLowerCase();
  return text;
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

const prevDepth = new Map<string, number>();
let failures = 0;

function check(cond: boolean, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`  ✗ INVARIANT: ${msg}`);
  }
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function printReveal(view: HostView): void {
  const round = view.round!;
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  console.log(`\n── Round ${round.index + 1}/${view.roundCount} · ${round.prompt.text}`);
  if (round.numericAnswer) console.log(`   answer: ${round.numericAnswer.answer} ${round.numericAnswer.unit ?? ''}`);
  console.log(`   ${round.submittedPlayerIds.length}/${view.players.length} answered · ${round.validCount} valid`);
  const groups = round.groups ?? [];
  const w = Math.max(10, ...groups.map((g) => g.display.length));
  for (const g of groups) {
    const who = g.playerIds.map((id) => names.get(id) ?? id).join(', ');
    console.log(
      `   ${g.display.padEnd(w)}  ${String(g.count).padStart(2)}×  ${TIERS[g.tier].label.padEnd(17)} ${String(g.points).padStart(3)}m  ${g.status.padEnd(10)} ${who}`,
    );
  }

  // invariants
  const results = round.results ?? {};
  for (const p of view.players) {
    const r = results[p.id];
    check(!!r, `player ${p.name} has no result in round ${round.index}`);
    if (!r) continue;
    check(r.points === TIERS[r.tier].points, `${p.name}: points ${r.points} ≠ tier ${r.tier}`);
    check(p.depth === r.depthAfter, `${p.name}: depth ${p.depth} ≠ depthAfter ${r.depthAfter}`);
    const before = prevDepth.get(p.id) ?? 0;
    check(r.depthAfter >= before, `${p.name}: depth went backwards ${before} → ${r.depthAfter}`);
    check(r.depthAfter - before === r.points, `${p.name}: depth delta ${r.depthAfter - before} ≠ points ${r.points}`);
  }
  const groupTotal = groups.reduce((n, g) => n + g.count, 0);
  check(groupTotal === round.submittedPlayerIds.length, `group counts ${groupTotal} ≠ submissions ${round.submittedPlayerIds.length}`);
  for (const g of groups) check(g.points === TIERS[g.tier].points, `group ${g.display}: points/tier mismatch`);
}

function commitDepths(view: HostView): void {
  for (const p of view.players) prevDepth.set(p.id, p.depth);
}

function printResults(view: HostView): void {
  console.log('\n══ Final leaderboard ══');
  const sorted = [...view.players].sort((a, b) => b.depth - a.depth);
  sorted.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.name.padEnd(10)} ${String(p.depth).padStart(4)} m  (${p.avatar})`));
  check(view.roundHistory.length === view.roundCount, `roundHistory has ${view.roundHistory.length} rounds, expected ${view.roundCount}`);
  for (const p of view.players) {
    const sum = view.roundHistory.reduce((n, r) => n + (r.results?.[p.id]?.points ?? 0), 0);
    check(sum === p.depth, `${p.name}: history sums to ${sum} but depth is ${p.depth}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const host = new Sock('host');
  await host.waitFor((m) => m.t === 'hello');
  host.send({
    t: 'host:create',
    config: { secondsPerPrompt: SECONDS, ...(PROMPTS ? { promptIds: PROMPTS } : {}) },
    ...(PIN ? { pin: PIN } : {}),
  } as ClientMessage);
  const created = await host.waitFor((m): m is Extract<ServerMessage, { t: 'host:created' }> => m.t === 'host:created');
  const first = await host.waitFor(isState);
  const firstView = first.view as HostView;
  console.log(JSON.stringify({ code: created.code, hostToken: created.hostToken, joinUrl: firstView.joinUrl }));
  console.log(`Room ${created.code} · ${firstView.config.promptIds.length} prompts · ${SECONDS}s each · ${PLAYERS} bots`);

  // Bots
  const bots: { sock: Sock; name: string; index: number; playerId?: string }[] = [];
  for (let i = 0; i < PLAYERS; i++) {
    const sock = new Sock(`bot:${NAMES[i]}`);
    await sock.waitFor((m) => m.t === 'hello');
    bots.push({ sock, name: NAMES[i]!, index: i });
  }
  await Promise.all(
    bots.map(async (b) => {
      b.sock.send({ t: 'player:join', code: created.code, name: b.name, avatar: AVATAR_IDS[b.index]! });
      const joined = await b.sock.waitFor((m): m is Extract<ServerMessage, { t: 'player:joined' }> => m.t === 'player:joined');
      b.playerId = joined.playerId;
    }),
  );
  const lobby = (await host.waitFor((m) => isState(m) && (m.view as HostView).players.length === PLAYERS)) as Extract<ServerMessage, { t: 'state' }>;
  console.log(`${(lobby.view as HostView).players.length} players in the lobby`);

  if (PAUSE_AT === 'lobby') {
    console.log('Paused in the lobby (--pause-at=lobby). Ctrl-C to stop.');
    return;
  }

  // Each bot answers from its own view of the game.
  const scheduled = new Map<string, number>();
  for (const b of bots) {
    b.sock.on((m) => {
      if (!isState(m)) return;
      const view = m.view as PlayerView;
      if (view.phase !== 'prompt' || !view.round) return;
      const key = `${b.index}:${view.round.index}`;
      if (scheduled.has(key)) return;
      scheduled.set(key, 1);
      // In --pause-at=prompt mode only half the bots answer, so the screen shows a live round.
      if (PAUSE_AT === 'prompt' && b.index % 2 === 1) return;
      const prompt = bank.getPrompt(view.round.promptId);
      const text = pickAnswer(prompt, b.index);
      if (text === null) return;
      const delay = 1_000 + Math.random() * Math.min(7_000, Math.max(1_000, SECONDS * 1000 - 3_000));
      setTimeout(() => b.sock.send({ t: 'player:answer', roundIndex: view.round!.index, text }), delay);
    });
  }

  // The host advances the game.
  let revealed = -1;
  let finished = false;
  const done = new Promise<void>((resolve) => {
    host.on((m) => {
      if (m.t === 'error') {
        console.error(`host error: ${m.code} ${m.message}`);
        return;
      }
      if (!isState(m)) return;
      const view = m.view as HostView;
      if (view.phase === 'reveal' && view.round && view.round.index !== revealed) {
        revealed = view.round.index;
        printReveal(view);
        commitDepths(view);
        if (PAUSE_AT === 'reveal') {
          console.log('Paused at the reveal (--pause-at=reveal). Ctrl-C to stop.');
          return;
        }
        setTimeout(() => host.send({ t: 'host:next' }), 2_000);
      } else if (view.phase === 'reveal' && view.round && view.round.index === revealed) {
        // moderation or reconnect refresh — keep depths in sync
        commitDepths(view);
      } else if (view.phase === 'results' && !finished) {
        finished = true;
        printResults(view);
        resolve();
      }
    });
  });

  host.send({ t: 'host:start' });
  if (PAUSE_AT === 'prompt') {
    console.log('Paused during the first prompt (--pause-at=prompt). Ctrl-C to stop.');
    return;
  }

  const roundCount = firstView.config.promptIds.length;
  const budgetMs = roundCount * (SECONDS * 1000 + 4_000) + 30_000;
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`game did not finish within ${budgetMs / 1000}s`)), budgetMs));
  await Promise.race([done, timeout]);

  if (failures) {
    console.error(`\n${failures} invariant failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('\nAll invariants held.');
  }

  if (KEEP_OPEN) {
    console.log('Keeping the room open in results (--keep-open). Ctrl-C to stop.');
    return;
  }
  for (const b of bots) b.sock.close();
  host.close();
  setTimeout(() => process.exit(failures ? 1 : 0), 200);
}

main().catch((e) => fail((e as Error).message));
