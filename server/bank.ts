/**
 * The prompt bank: every `server/data/bank/*.json` file validated at boot,
 * with a cached alias matcher per open prompt. A tiny built-in bank keeps dev
 * running when no files exist yet.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { PromptBank, PromptSummary } from '../shared/types.js';
import { MAX_ROUNDS } from '../shared/types.js';
import { DEFAULT_PROMPT_IDS } from '../shared/theme.js';
import { buildMatcher, normalizeAnswer, type Matcher } from '../shared/scoring.js';
import { log } from './log.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const bankAnswerSchema = z
  .object({
    canonical: z.string().trim().min(1).max(80),
    aliases: z.array(z.string().trim().max(80)),
    tier: z.enum(['common', 'uncommon', 'rare', 'deep']),
    /** pinned to a puddle no matter how few say it (the town outside the window) */
    obvious: z.boolean().optional(),
    note: z.string().max(400).optional(),
  })
  // strict so a misspelled flag ("obvoius": true) fails bank:check loudly
  // instead of being silently stripped and scoring by rarity anyway.
  .strict();

export const numericAnswerSchema = z.object({
  answer: z.number().finite(),
  unit: z.string().max(40).optional(),
  source: z.string().max(400).optional(),
  asOf: z.string().max(40).optional(),
  alternatives: z.string().max(600).optional(),
});

export const promptBankSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'id must be lowercase kebab-case'),
    text: z.string().trim().min(1).max(200),
    type: z.enum(['open', 'numeric']),
    category: z.enum(['starter', 'local', 'closest']),
    approved: z.boolean(),
    answers: z.array(bankAnswerSchema).optional(),
    numeric: numericAnswerSchema.optional(),
    hostNotes: z.string().max(1000).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.type === 'open' && (!p.answers || p.answers.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['answers'], message: 'open prompts need answers' });
    }
    if (p.type === 'numeric' && !p.numeric) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['numeric'], message: 'numeric prompts need numeric.answer' });
    }
  });

// ---------------------------------------------------------------------------
// Validation (shared by boot, tests and scripts/check-bank.ts)
// ---------------------------------------------------------------------------

export interface BankFileReport {
  file: string;
  ok: boolean;
  prompt?: PromptBank;
  errors: string[];
  warnings: string[];
}

export function validateBankJson(file: string, text: string): BankFileReport {
  const report: BankFileReport = { file, ok: false, errors: [], warnings: [] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    report.errors.push(`invalid JSON: ${(err as Error).message}`);
    return report;
  }
  const parsed = promptBankSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 10)) {
      report.errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return report;
  }
  const prompt = parsed.data as PromptBank;

  if (prompt.type === 'open' && prompt.answers) {
    const seenCanonical = new Map<string, string>();
    const seenAlias = new Map<string, string>();
    let emptyAliases = 0;
    for (const a of prompt.answers) {
      const nc = normalizeAnswer(a.canonical);
      if (!nc) {
        report.errors.push(`canonical "${a.canonical}" normalises to nothing`);
        continue;
      }
      const prev = seenCanonical.get(nc);
      if (prev) report.errors.push(`duplicate canonical "${a.canonical}" (also "${prev}")`);
      seenCanonical.set(nc, a.canonical);
      if (a.aliases.length === 0) emptyAliases += 1;
      for (const al of a.aliases) {
        const na = normalizeAnswer(al);
        if (!na) continue;
        const owner = seenAlias.get(na);
        if (owner && owner !== a.canonical) {
          report.warnings.push(`alias "${al}" appears under both "${owner}" and "${a.canonical}"`);
        }
        seenAlias.set(na, a.canonical);
      }
    }
    // An alias that equals another entry's canonical would swallow that entry.
    for (const a of prompt.answers) {
      for (const al of a.aliases) {
        const na = normalizeAnswer(al);
        const other = seenCanonical.get(na);
        if (other && other !== a.canonical) {
          report.errors.push(`alias "${al}" of "${a.canonical}" equals canonical "${other}"`);
        }
      }
    }
    if (emptyAliases > 0) report.warnings.push(`${emptyAliases} answer(s) have no aliases`);
  }

  report.ok = report.errors.length === 0;
  if (report.ok) report.prompt = prompt;
  return report;
}

export function validateBankFile(path: string): BankFileReport {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    return { file: path, ok: false, errors: [`cannot read: ${(err as Error).message}`], warnings: [] };
  }
  return validateBankJson(path, text);
}

export function listBankFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

// ---------------------------------------------------------------------------
// Bank
// ---------------------------------------------------------------------------

/** The slice of the bank the room state machine depends on (mockable in tests). */
export interface BankLike {
  has(id: string): boolean;
  getPrompt(id: string): PromptBank | undefined;
  matcherFor(id: string): Matcher;
  listSummaries(): PromptSummary[];
}

export class Bank implements BankLike {
  private readonly prompts = new Map<string, PromptBank>();
  private readonly matchers = new Map<string, Matcher>();
  readonly source: 'files' | 'fallback';

  private constructor(prompts: PromptBank[], source: 'files' | 'fallback') {
    for (const p of prompts) this.prompts.set(p.id, p);
    this.source = source;
  }

  static fromPrompts(prompts: PromptBank[], source: 'files' | 'fallback' = 'files'): Bank {
    return new Bank(prompts, source);
  }

  /** Loads every valid file in `dir`; falls back to the built-in bank if none load. */
  static load(dir: string): Bank {
    const loaded: PromptBank[] = [];
    for (const file of listBankFiles(dir)) {
      const report = validateBankFile(file);
      if (!report.ok || !report.prompt) {
        log.warn('bank: skipping invalid file', { file, errors: report.errors.slice(0, 3) });
        continue;
      }
      for (const w of report.warnings) log.debug('bank: warning', { file, warning: w });
      loaded.push(report.prompt);
    }
    if (loaded.length === 0) {
      log.warn('bank: no prompt files found, using the built-in fallback bank', { dir });
      return new Bank(FALLBACK_PROMPTS, 'fallback');
    }
    log.info('bank: loaded prompts', {
      count: loaded.length,
      answers: loaded.reduce((n, p) => n + (p.answers?.length ?? 0), 0),
    });
    return new Bank(loaded, 'files');
  }

  has(id: string): boolean {
    return this.prompts.has(id);
  }

  getPrompt(id: string): PromptBank | undefined {
    return this.prompts.get(id);
  }

  matcherFor(id: string): Matcher {
    let m = this.matchers.get(id);
    if (!m) {
      const p = this.prompts.get(id);
      m = buildMatcher({ answers: p?.answers ?? [] });
      this.matchers.set(id, m);
    }
    return m;
  }

  listSummaries(): PromptSummary[] {
    const order: Record<PromptBank['category'], number> = { starter: 0, local: 1, closest: 2 };
    return [...this.prompts.values()]
      .sort((a, b) => order[a.category] - order[b.category] || a.id.localeCompare(b.id))
      .map((p) => ({
        id: p.id,
        text: p.text,
        type: p.type,
        category: p.category,
        approved: p.approved,
        answerCount: p.answers?.length ?? 0,
        hostNotes: p.hostNotes,
      }));
  }

  size(): number {
    return this.prompts.size;
  }

  /** The default seven for a new room: the brief's starters when present, else the first approved prompts. */
  defaultPromptIds(): string[] {
    let ids = DEFAULT_PROMPT_IDS.filter((id) => this.prompts.has(id));
    if (ids.length === 0) {
      ids = this.listSummaries()
        .filter((p) => p.approved)
        .slice(0, MAX_ROUNDS)
        .map((p) => p.id);
    }
    if (ids.length === 0) ids = this.listSummaries().slice(0, MAX_ROUNDS).map((p) => p.id);
    return ids;
  }
}

// ---------------------------------------------------------------------------
// Fallback bank (dev only — a dozen obvious answers per default prompt)
// ---------------------------------------------------------------------------

function simple(canonical: string, tier: PromptBank['answers'] extends (infer A)[] | undefined ? (A extends { tier: infer T } ? T : never) : never, ...aliases: string[]) {
  return { canonical, aliases, tier };
}

export const FALLBACK_PROMPTS: PromptBank[] = [
  {
    id: 's1-deadly-animal',
    text: 'Name an Australian animal that could kill you.',
    type: 'open',
    category: 'starter',
    approved: true,
    answers: [
      simple('Eastern brown snake', 'common', 'brown snake', 'brown'),
      simple('Tiger snake', 'common', 'tiger'),
      simple('Great white shark', 'common', 'shark', 'white pointer'),
      simple('Saltwater crocodile', 'common', 'crocodile', 'croc', 'saltie'),
      simple('Box jellyfish', 'common', 'box jelly'),
      simple('Funnel-web spider', 'common', 'funnel web', 'funnelweb'),
      simple('Redback spider', 'common', 'redback'),
      simple('Blue-ringed octopus', 'uncommon', 'blue ring', 'blue ringed octopus'),
      simple('Kangaroo', 'uncommon', 'roo'),
      simple('Cassowary', 'uncommon'),
      simple('Stonefish', 'rare'),
      simple('Irukandji', 'rare', 'irukandji jellyfish'),
      simple('Cone snail', 'deep', 'cone shell'),
    ],
  },
  {
    id: 's2-vic-country-town',
    text: 'Name a Victorian country town.',
    type: 'open',
    category: 'starter',
    approved: true,
    answers: [
      simple('Ballarat', 'common'),
      simple('Bendigo', 'common'),
      simple('Geelong', 'common'),
      simple('Shepparton', 'common', 'shepp'),
      simple('Mildura', 'common'),
      simple('Warrnambool', 'common', 'warrny'),
      simple('Echuca', 'uncommon'),
      simple('Bright', 'uncommon'),
      simple('Daylesford', 'uncommon'),
      simple('Lorne', 'uncommon'),
      simple('Castlemaine', 'rare'),
      simple('Nhill', 'deep'),
    ],
  },
  {
    id: 's3-aussie-biscuit',
    text: 'Name a classic Aussie biscuit.',
    type: 'open',
    category: 'starter',
    approved: true,
    answers: [
      simple('Tim Tam', 'common', 'tim tams', 'timtam'),
      simple('Anzac biscuit', 'common', 'anzac', 'anzacs'),
      simple('Iced VoVo', 'common', 'iced vo vo', 'vovo'),
      simple('Monte Carlo', 'uncommon', 'monte carlos'),
      simple('Kingston', 'uncommon', 'kingstons'),
      simple('Scotch Finger', 'common', 'scotch fingers'),
      simple('Mint Slice', 'uncommon', 'mint slices'),
      simple('Shortbread Cream', 'uncommon', 'shortbread creams'),
      simple('Teddy Bear biscuit', 'rare', 'teddy bears', 'teddy bear'),
      simple('Milk Arrowroot', 'uncommon', 'arrowroot', 'arrowroots'),
      simple('Gaiety', 'deep', 'gaieties'),
      simple('Jatz', 'rare'),
    ],
  },
  {
    id: 's5-aussie-slang',
    text: 'Name an Aussie slang word.',
    type: 'open',
    category: 'starter',
    approved: true,
    answers: [
      simple('Arvo', 'common'),
      simple('Servo', 'common'),
      simple('Bottle-o', 'common', 'bottleo', 'bottle o'),
      simple('Mate', 'common'),
      simple('Thongs', 'common', 'thong'),
      simple('Esky', 'common'),
      simple('Maccas', 'common', 'macca'),
      simple('Brekkie', 'uncommon', 'brekky'),
      simple('Durry', 'uncommon', 'durries'),
      simple('Dunny', 'uncommon'),
      simple('Ute', 'uncommon'),
      simple('Fair dinkum', 'uncommon', 'dinkum'),
      simple('Furphy', 'deep'),
    ],
  },
  {
    id: 's6-afl-player',
    text: 'Name an AFL player, past or present.',
    type: 'open',
    category: 'starter',
    approved: true,
    answers: [
      simple('Gary Ablett Jr', 'common', 'gary ablett', 'ablett', 'gaz'),
      simple('Dustin Martin', 'common', 'dusty', 'martin'),
      simple('Lance Franklin', 'common', 'buddy', 'buddy franklin', 'franklin'),
      simple('Patrick Dangerfield', 'common', 'danger', 'dangerfield'),
      simple('Nat Fyfe', 'uncommon', 'fyfe'),
      simple('Marcus Bontempelli', 'common', 'bont', 'bontempelli'),
      simple('Nick Riewoldt', 'uncommon', 'riewoldt'),
      simple('Wayne Carey', 'uncommon', 'carey'),
      simple('Tony Lockett', 'uncommon', 'plugger', 'lockett'),
      simple('Leigh Matthews', 'rare', 'lethal', 'matthews'),
      simple('Ted Whitten', 'rare', 'mr football', 'whitten'),
      simple('Haydn Bunton', 'deep', 'bunton'),
    ],
  },
  {
    id: 's7-melbourne-suburb',
    text: 'Name a Melbourne suburb.',
    type: 'open',
    category: 'starter',
    approved: true,
    answers: [
      simple('St Kilda', 'common', 'saint kilda', 'stkilda'),
      simple('Richmond', 'common'),
      simple('Fitzroy', 'common'),
      simple('Brunswick', 'common'),
      simple('Footscray', 'common'),
      simple('Carlton', 'common'),
      simple('Brighton', 'common'),
      simple('Frankston', 'uncommon', 'franga'),
      simple('Werribee', 'uncommon'),
      simple('Toorak', 'uncommon'),
      simple('Yarraville', 'rare'),
      simple('Bulleen', 'deep'),
    ],
  },
  {
    id: 's8-gor-town',
    text: 'Name a town on the Great Ocean Road.',
    type: 'open',
    category: 'starter',
    approved: true,
    answers: [
      simple('Lorne', 'common'),
      simple('Apollo Bay', 'common', 'apollo'),
      simple('Torquay', 'common'),
      simple('Anglesea', 'common'),
      simple('Aireys Inlet', 'uncommon', 'aireys'),
      simple('Port Campbell', 'uncommon'),
      simple('Wye River', 'uncommon', 'wye'),
      simple('Kennett River', 'rare', 'kennett'),
      simple('Separation Creek', 'rare', 'sep creek', 'sepi'),
      simple('Skenes Creek', 'rare', 'skenes'),
      simple('Fairhaven', 'rare'),
      simple('Wongarra', 'deep'),
    ],
  },
];
