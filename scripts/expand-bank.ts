/**
 * Data-driven bank expansion: pull every real place from Wikipedia's own
 * category lists and add the ones the bank doesn't know yet. New entries are
 * appended with a placeholder tier — run `npm run bank:grade -- <id> --apply`
 * straight after, so the impartial pageview grading prices them (a hamlet
 * nobody reads about lands as a deep cut, exactly where it belongs).
 *
 *   npm run bank:expand -- s2-vic-country-town            # dry run
 *   npm run bank:expand -- s2-vic-country-town --apply
 *   npm run bank:expand -- --all --apply
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PromptBank } from '../shared/types.js';
import { buildMatcher, normalizeAnswer } from '../shared/scoring.js';

const UA = 'SeparationCreekKrillion/1.0 (party game bank expansion; sam.a.hudson99@gmail.com)';
const BANK_DIR = join(process.cwd(), 'server', 'data', 'bank');

/** Prompt → the Wikipedia categories whose pages are valid answers. */
const SOURCES: Record<string, { categories: string[]; skip: RegExp }> = {
  's2-vic-country-town': {
    categories: [
      'Towns in Victoria (state)',
      'Coastal towns in Victoria (state)',
      'Ghost towns in Victoria (state)',
      'Mining towns in Victoria (state)',
    ],
    // region/list pages and Melbourne-metro noise
    skip: /^(list of|category:)|suburbs|\(region|railway|electoral|shire of|city of/i,
  },
  's7-melbourne-suburb': {
    categories: ['Suburbs of Melbourne'],
    skip: /^(list of|category:)|suburbs \(|western suburbs|eastern suburbs|northern suburbs|southern suburbs|south-eastern suburbs/i,
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function categoryMembers(category: string): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  for (;;) {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(`Category:${category}`)}` +
      `&cmlimit=500&cmtype=page&format=json${cont ? `&cmcontinue=${encodeURIComponent(cont)}` : ''}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`category fetch failed: ${category} (${res.status})`);
    const d = (await res.json()) as {
      query?: { categorymembers?: { title: string }[] };
      continue?: { cmcontinue?: string };
    };
    titles.push(...(d.query?.categorymembers ?? []).map((m) => m.title));
    cont = d.continue?.cmcontinue;
    if (!cont) break;
    await sleep(120);
  }
  return titles;
}

/** "Acheron, Victoria" → "Acheron"; "Newtown (Golden Plains Shire)" → "Newtown". */
function cleanTitle(title: string): string {
  return title
    .replace(/,\s*victoria.*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

async function expandPrompt(promptId: string, apply: boolean): Promise<void> {
  const src = SOURCES[promptId]!;
  const file = join(BANK_DIR, `${promptId}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8')) as PromptBank & { answers: NonNullable<PromptBank['answers']> };
  // exact/alias/squash matching only — no fuzzy, so a real town two letters
  // away from an existing one is still added, not silently swallowed
  const matcher = buildMatcher(data);

  const titles = new Set<string>();
  for (const cat of src.categories) {
    const members = await categoryMembers(cat);
    console.log(`  ${cat}: ${members.length} pages`);
    for (const t of members) titles.add(t);
  }

  const seen = new Set<string>();
  const added: string[] = [];
  for (const title of [...titles].sort()) {
    if (src.skip.test(title)) continue;
    const name = cleanTitle(title);
    if (name.length < 2 || name.length > 60) continue;
    const norm = normalizeAnswer(name);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    if (matcher.match(name, { fuzzy: false })?.matched) continue; // already in the bank
    data.answers.push({ canonical: name, aliases: [], tier: 'rare' });
    added.push(name);
  }

  console.log(`${promptId}: +${added.length} new answers (${data.answers.length} total)${apply ? '' : ' — dry run, not written'}`);
  if (added.length) console.log(`  e.g. ${added.slice(0, 12).join(', ')}${added.length > 12 ? ', …' : ''}`);
  if (apply && added.length) {
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`  written — now run: npm run bank:grade -- ${promptId} --apply`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const apply = process.argv.includes('--apply');
  const ids = process.argv.includes('--all') ? Object.keys(SOURCES) : args.filter((a) => SOURCES[a]);
  if (!ids.length) {
    console.error(`usage: npm run bank:expand -- <promptId...>|--all [--apply]\nexpandable: ${Object.keys(SOURCES).join(', ')}`);
    process.exit(2);
  }
  for (const id of ids) await expandPrompt(id, apply);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
