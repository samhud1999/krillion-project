/**
 * Impartial rarity grading for answer banks.
 *
 * For every answer in the chosen prompts, this tool:
 *   1. resolves the canonical to an English Wikipedia article (direct title
 *      candidates first, then a context-hinted search; disambiguation pages
 *      are rejected);
 *   2. fetches the article's monthly pageviews for the last ~12 full months
 *      and takes the median;
 *   3. applies an Australian-knowledge boost: articles whose summary marks
 *      them as Australian count their popularity ×4, because a modest global
 *      pageview count can still be something every Australian knows
 *      (Iced VoVo), while a big global count with no Australian flavour is
 *      genuinely famous everywhere (Shark);
 *   4. assigns tiers by fixed thresholds on that effective popularity:
 *      ≥3000 → common, ≥1000 → uncommon, ≥300 → rare, below → deep.
 *      Entries with no on-topic article keep their editorial tier (absence of
 *      a Wikipedia page is not evidence of rarity for a supermarket biscuit);
 *      the report marks them for eyeballing.
 *
 * `obvious`-flagged entries keep their tier (their score is pinned anyway).
 * Results are cached in tmp/wiki-grade-cache.json so re-runs are cheap.
 *
 *   npm run bank:grade -- s3-aussie-biscuit            # dry run, prints table
 *   npm run bank:grade -- s3-aussie-biscuit --apply    # writes tiers + report
 *   npm run bank:grade -- --all --apply                # every graded prompt
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'SeparationCreekKrillion/1.0 (party game bank grading; sam.a.hudson99@gmail.com)';
const AU_BOOST = 4;
const AU_RE = /(australi|victoria|melbourne|sydney|new south wales|queensland|tasmania|canberra|adelaide|perth|brisbane|aborigin|afl )/i;
/**
 * Absolute familiarity thresholds on effective views (AU-boosted median
 * monthly pageviews). Fixed anchors rather than within-prompt percentiles, so
 * a pool that happens to contain only famous things doesn't get its tail
 * stretched into fake deep cuts.
 */
const CUTS: { min: number; tier: 'common' | 'uncommon' | 'rare' }[] = [
  { min: 3000, tier: 'common' },
  { min: 1000, tier: 'uncommon' },
  { min: 300, tier: 'rare' },
];
const TIERS = ['common', 'uncommon', 'rare', 'deep'] as const;
type Tier = (typeof TIERS)[number];

/**
 * Prompts we grade: title candidates + search hint for resolution, and a
 * topic gate the resolved article's summary must pass — "Nice" must land on
 * Nice (biscuit), never Nice, France.
 */
const PLACE_RE = /(town|locality|city|hamlet|settlement|suburb|community|coastal|bounded locality|region)/i;
const GRADED: Record<string, { candidates: (c: string) => string[]; hint: string; topic: (text: string) => boolean }> = {
  's1-deadly-animal': {
    candidates: (c) => [c],
    hint: 'animal',
    topic: (t) => /(animal|snake|spider|shark|octopus|jellyfish|crocodil|species|genus|bird|fish|ant |stonefish|cassowary|reptile|marsupial|mammal|cephalopod|cnidar)/i.test(t),
  },
  's2-vic-country-town': {
    candidates: (c) => [`${c}, Victoria`, c],
    hint: 'Victoria Australia town',
    topic: (t) => AU_RE.test(t) && PLACE_RE.test(t),
  },
  's3-aussie-biscuit': {
    candidates: (c) => [`${c} (biscuit)`, `Arnott's ${c}`, `${c} biscuit`, c],
    hint: 'Australian biscuit',
    topic: (t) => /(biscuit|cookie|cracker|snack|confection|arnott|shortbread|wafer|sweet baked)/i.test(t),
  },
  's6-afl-player': {
    candidates: (c) => [c, `${c} (footballer)`, `${c} (Australian footballer)`],
    hint: 'AFL footballer',
    topic: (t) => /(footballer|football|afl|aflw)/i.test(t),
  },
  's7-melbourne-suburb': {
    candidates: (c) => [`${c}, Victoria`, c],
    hint: 'Melbourne suburb',
    topic: (t) => AU_RE.test(t) && PLACE_RE.test(t),
  },
  's8-gor-town': {
    candidates: (c) => [`${c}, Victoria`, c],
    hint: 'Victoria Australia Great Ocean Road',
    topic: (t) => AU_RE.test(t) && PLACE_RE.test(t),
  },
};

const BANK_DIR = join(process.cwd(), 'server', 'data', 'bank');
const CACHE_FILE = join(process.cwd(), 'tmp', 'wiki-grade-cache.json');

interface CacheEntry {
  article: string | null;
  medianViews: number | null;
  au: boolean;
  /** unused legacy field kept for cache-shape compatibility */
  hits?: number | null;
}
type Cache = Record<string, CacheEntry>;

const cache: Cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const saveCache = () => {
  mkdirSync(join(process.cwd(), 'tmp'), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 3): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(800 * (i + 1));
        continue;
      }
      return res;
    } catch {
      await sleep(800 * (i + 1));
    }
  }
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/, victoria.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

interface Summary {
  title: string;
  type: string;
  description?: string;
  extract?: string;
}

async function summaryFor(title: string): Promise<Summary | null> {
  const res = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`);
  if (!res || !res.ok) return null;
  const d = (await res.json()) as Summary;
  if (d.type === 'disambiguation') return null;
  return d;
}

async function searchFor(q: string): Promise<string | null> {
  const res = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json`);
  if (!res || !res.ok) return null;
  const d = (await res.json()) as { query?: { search?: { title: string }[] } };
  return d.query?.search?.[0]?.title ?? null;
}


function monthRange(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); // first of current month = exclusive-ish end
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
  return { start: fmt(start), end: fmt(end) };
}

async function viewsFor(article: string): Promise<number | null> {
  const { start, end } = monthRange();
  const res = await get(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article.replace(/ /g, '_'))}/monthly/${start}/${end}`,
  );
  if (!res || !res.ok) return null;
  const d = (await res.json()) as { items?: { views: number }[] };
  const vs = (d.items ?? []).map((i) => i.views).sort((a, b) => a - b);
  if (!vs.length) return null;
  return vs[Math.floor(vs.length / 2)]!;
}

/** Resolve + measure one canonical, with caching. */
async function grade(promptId: string, canonical: string): Promise<CacheEntry> {
  const key = `v3:${promptId}:${canonical}`;
  if (cache[key]) return cache[key]!;
  const cfg = GRADED[promptId]!;
  const onTopic = (s: Summary) => cfg.topic(`${s.description ?? ''} ${s.extract ?? ''}`);

  let summary: Summary | null = null;
  for (const cand of cfg.candidates(canonical)) {
    const s = await summaryFor(cand);
    if (s && onTopic(s)) {
      summary = s;
      break;
    }
  }
  if (!summary) {
    const hit = await searchFor(`${canonical} ${cfg.hint}`);
    // only accept a search hit that is plausibly the same thing, on topic
    if (hit && (norm(hit).includes(norm(canonical)) || norm(canonical).includes(norm(hit)))) {
      const s = await summaryFor(hit);
      if (s && onTopic(s)) summary = s;
    }
  }

  let entry: CacheEntry;
  if (!summary) {
    entry = { article: null, medianViews: null, au: false, hits: null };
  } else {
    const views = await viewsFor(summary.title);
    const au = AU_RE.test(`${summary.description ?? ''} ${summary.extract ?? ''}`);
    entry = { article: summary.title, medianViews: views, au, hits: null };
  }
  cache[key] = entry;
  return entry;
}

interface Row {
  canonical: string;
  tier: Tier;
  obvious: boolean;
  graded: CacheEntry;
  effective: number;
  newTier: Tier;
}

async function gradePrompt(promptId: string, apply: boolean): Promise<Row[]> {
  const file = join(BANK_DIR, `${promptId}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8')) as {
    answers: { canonical: string; tier: Tier; obvious?: boolean; [k: string]: unknown }[];
  };

  // measure with modest concurrency
  const rows: Row[] = [];
  const queue = [...data.answers];
  let done = 0;
  const workers = Array.from({ length: 6 }, async () => {
    for (;;) {
      const a = queue.shift();
      if (!a) return;
      const graded = await grade(promptId, a.canonical);
      rows.push({
        canonical: a.canonical,
        tier: a.tier,
        obvious: !!a.obvious,
        graded,
        effective: 0, // computed below once the prompt's maxima are known
        newTier: a.tier, // assigned below
      });
      done += 1;
      if (done % 50 === 0) {
        process.stderr.write(`  ${promptId}: ${done}/${data.answers.length}\n`);
        saveCache();
      }
      await sleep(60);
    }
  });
  await Promise.all(workers);
  saveCache();

  // Data governs where data exists: percentile tiers over the entries that
  // resolved to an on-topic article, ranked by AU-boosted median pageviews.
  // Entries Wikipedia simply cannot see (branded products living under a
  // parent page, hyper-local spots) keep their editorial tier and are
  // flagged in the report — absence of an article is not evidence of rarity
  // for a biscuit every Australian supermarket stocks.
  for (const r of rows) {
    r.effective = (r.graded.medianViews ?? 0) * (r.graded.au ? AU_BOOST : 1);
  }
  const resolved = rows.filter((r) => r.graded.article && r.graded.medianViews !== null);
  for (const r of resolved) {
    r.newTier = CUTS.find((c) => r.effective >= c.min)?.tier ?? 'deep';
    if (r.obvious) r.newTier = r.tier; // pinned entries keep their editorial tier
  }
  const sorted = [...rows].sort((a, b) => b.effective - a.effective);

  if (apply) {
    const byName = new Map(rows.map((r) => [r.canonical, r] as const));
    for (const a of data.answers) {
      const r = byName.get(a.canonical);
      if (r && !r.obvious) a.tier = r.newTier;
    }
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  return sorted;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const apply = process.argv.includes('--apply');
  const ids = process.argv.includes('--all') ? Object.keys(GRADED) : args.filter((a) => GRADED[a]);
  if (!ids.length) {
    console.error(`usage: npm run bank:grade -- <promptId...>|--all [--apply]\ngradable: ${Object.keys(GRADED).join(', ')}`);
    process.exit(2);
  }

  const reportLines: string[] = [
    '# Bank rarity grading report',
    '',
    `Generated by \`npm run bank:grade\` on ${new Date().toISOString().slice(0, 10)}.`,
    'Median monthly en.wikipedia pageviews (12 months, real users), Australian topics ×' + AU_BOOST + '.',
    'Tiers by fixed thresholds on effective views: ≥3000 common · ≥1000 uncommon · ≥300 rare · below deep.',
    'Entries with no on-topic article keep their editorial tier (marked). `obvious`-pinned entries keep their tier.',
    '',
  ];

  for (const id of ids) {
    console.log(`\n── ${id} ──`);
    const rows = await gradePrompt(id, apply);
    const changed = rows.filter((r) => r.newTier !== r.tier && !r.obvious);
    const unresolved = rows.filter((r) => !r.graded.article).length;
    console.log(
      `${rows.length} answers · ${rows.length - unresolved} resolved · ${unresolved} kept editorial tier · ${changed.length} tier changes${apply ? ' (written)' : ' (dry run)'}`,
    );
    reportLines.push(`## ${id}`, '', '| answer | article | views/mo | AU | tier | → |', '|---|---|---:|:-:|---|---|');
    for (const r of rows) {
      const art = r.graded.article ? r.graded.article.replace(/\|/g, '\\|') : '—';
      const v = r.graded.medianViews === null ? '—' : String(r.graded.medianViews);
      const arrow = r.obvious
        ? 'obvious'
        : !r.graded.article
          ? 'no data — kept'
          : r.newTier === r.tier
            ? '·'
            : `**${r.newTier}**`;
      reportLines.push(`| ${r.canonical} | ${art} | ${v} | ${r.graded.au ? '🇦🇺' : ''} | ${r.tier} | ${arrow} |`);
    }
    reportLines.push('');
    for (const r of changed.slice(0, 12)) {
      console.log(`  ${r.canonical.padEnd(28)} ${String(r.graded.medianViews ?? '—').padStart(8)}/mo ${r.graded.au ? 'AU' : '  '}  ${r.tier} → ${r.newTier}`);
    }
    if (changed.length > 12) console.log(`  … and ${changed.length - 12} more`);
  }

  if (apply) {
    mkdirSync(join(process.cwd(), 'docs'), { recursive: true });
    writeFileSync(join(process.cwd(), 'docs', 'bank-grading.md'), reportLines.join('\n'));
    console.log('\nreport written to docs/bank-grading.md — run `npm run bank:check` next');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
