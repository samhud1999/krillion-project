/**
 * Validates every prompt bank file and prints a summary table.
 *
 *   npm run bank:check
 *
 * Exit 1 when any file is invalid.
 */
import { basename } from 'node:path';
import { DEFAULT_PROMPT_IDS } from '../shared/theme.js';
import { listBankFiles, validateBankFile } from '../server/bank.js';
import { BANK_DIR } from '../server/paths.js';

const files = listBankFiles(BANK_DIR());
if (files.length === 0) {
  console.error(`No bank files found in ${BANK_DIR()}`);
  process.exit(1);
}

const rows: string[][] = [['id', 'type', 'category', 'approved', 'answers', 'common', 'uncommon', 'rare', 'deep', 'status']];
let failures = 0;
const warnings: string[] = [];

for (const file of files) {
  const r = validateBankFile(file);
  const id = basename(file, '.json');
  if (!r.ok || !r.prompt) {
    failures += 1;
    rows.push([id, '?', '?', '?', '-', '-', '-', '-', '-', 'INVALID']);
    for (const e of r.errors) console.error(`  ✗ ${id}: ${e}`);
    continue;
  }
  const p = r.prompt;
  const tiers = { common: 0, uncommon: 0, rare: 0, deep: 0 };
  for (const a of p.answers ?? []) tiers[a.tier] += 1;
  if (p.id !== id) warnings.push(`${id}: file name does not match id "${p.id}"`);
  for (const w of r.warnings) warnings.push(`${id}: ${w}`);
  const total = p.answers?.length ?? 0;
  if (total && tiers.deep / total > 0.2) {
    warnings.push(
      `${id}: ${tiers.deep} of ${total} answers are "deep" (${Math.round((100 * tiers.deep) / total)}%); deep should be a true deep cut, aim for 20% or less`,
    );
  }
  rows.push([
    id,
    p.type,
    p.category,
    p.approved ? 'yes' : 'draft',
    p.type === 'numeric' ? `= ${p.numeric?.answer}` : String(p.answers?.length ?? 0),
    String(tiers.common),
    String(tiers.uncommon),
    String(tiers.rare),
    String(tiers.deep),
    'ok',
  ]);
}

const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)));
for (const [i, r] of rows.entries()) {
  console.log(r.map((c, j) => (c ?? '').padEnd(widths[j]!)).join('  '));
  if (i === 0) console.log(widths.map((w) => '-'.repeat(w)).join('  '));
}

const present = new Set(files.map((f) => basename(f, '.json')));
const missingDefaults = DEFAULT_PROMPT_IDS.filter((id) => !present.has(id));
if (missingDefaults.length) warnings.push(`default prompts missing: ${missingDefaults.join(', ')}`);

if (warnings.length) {
  console.log('\nWarnings:');
  for (const w of warnings) console.log(`  • ${w}`);
}
console.log(`\n${files.length} files, ${failures} invalid, ${warnings.length} warnings`);
process.exit(failures ? 1 : 0);
