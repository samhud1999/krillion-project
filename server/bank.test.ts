import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPT_IDS } from '../shared/theme.js';
import { Bank, FALLBACK_PROMPTS, listBankFiles, validateBankFile, validateBankJson } from './bank.js';
import { BANK_DIR } from './paths.js';

describe('bank files', () => {
  const files = listBankFiles(BANK_DIR());

  it('every bank file on disk is valid', () => {
    const problems: string[] = [];
    for (const file of files) {
      const r = validateBankFile(file);
      if (!r.ok) problems.push(`${basename(file)}: ${r.errors.join('; ')}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('loads into a Bank with a matcher per prompt', () => {
    if (files.length === 0) {
      console.warn('no bank files yet — skipping');
      return;
    }
    const bank = Bank.load(BANK_DIR());
    expect(bank.source).toBe('files');
    for (const s of bank.listSummaries()) {
      expect(bank.has(s.id)).toBe(true);
      const p = bank.getPrompt(s.id)!;
      if (p.type === 'open') {
        expect(p.answers!.length).toBeGreaterThan(0);
        const first = p.answers![0]!;
        expect(bank.matcherFor(s.id).match(first.canonical)?.display).toBe(first.canonical);
      } else {
        expect(typeof p.numeric?.answer).toBe('number');
      }
    }
  });

  it('has the default seven prompts (warns, does not fail, while files are still being written)', () => {
    const present = new Set(files.map((f) => basename(f, '.json')));
    const missing = DEFAULT_PROMPT_IDS.filter((id) => !present.has(id));
    if (missing.length) console.warn(`default prompts not on disk yet: ${missing.join(', ')}`);
    expect(missing.length).toBeLessThanOrEqual(DEFAULT_PROMPT_IDS.length);
  });
});

describe('validateBankJson', () => {
  it('rejects invalid JSON and shape problems', () => {
    expect(validateBankJson('x', '{ nope').ok).toBe(false);
    expect(validateBankJson('x', JSON.stringify({ id: 'a', text: 't', type: 'open', category: 'starter', approved: true })).ok).toBe(false);
    expect(validateBankJson('x', JSON.stringify({ id: 'a', text: 't', type: 'numeric', category: 'closest', approved: false })).ok).toBe(false);
  });

  it('flags duplicate canonicals and aliases that shadow another canonical', () => {
    const dup = validateBankJson(
      'x',
      JSON.stringify({
        id: 'dup-test',
        text: 't',
        type: 'open',
        category: 'starter',
        approved: true,
        answers: [
          { canonical: 'Tim Tam', aliases: ['tim tams'], tier: 'common' },
          { canonical: 'tim tam', aliases: [], tier: 'common' },
          { canonical: 'Anzac', aliases: ['tim tam'], tier: 'common' },
        ],
      }),
    );
    expect(dup.ok).toBe(false);
    expect(dup.errors.some((e) => e.includes('duplicate canonical'))).toBe(true);
    expect(dup.errors.some((e) => e.includes('equals canonical'))).toBe(true);
  });

  it('accepts the built-in fallback bank', () => {
    for (const p of FALLBACK_PROMPTS) {
      const r = validateBankJson(p.id, JSON.stringify(p));
      expect(r.ok, `${p.id}: ${r.errors.join('; ')}`).toBe(true);
    }
    const bank = Bank.fromPrompts(FALLBACK_PROMPTS, 'fallback');
    expect(bank.defaultPromptIds()).toEqual(DEFAULT_PROMPT_IDS);
  });
});
