// Sanity check: computed indicators vs report-data.sample.json > expectedComputed.
import { computeReport } from '../src/lib/compute.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '../src/data/student.json'), 'utf8'));
const r = computeReport(data);

const got = {
  rawScore: r.rawScore, correct: r.correctCount, percent: r.percent,
  tiers: Object.fromEntries(Object.entries(r.tiers).map(([k, v]) => [k, { n: v.n, correct: v.correct, pct: v.pct }])),
  kdi: r.kdi, mastery: `${r.mastery.label} (${r.mastery.en})`,
  adjusted: r.adjusted, potential: r.potential,
  technicalLost: r.technicalLost, gapLost: r.gapLost,
  ci: r.ci, percentile: r.percentile,
};
console.log(JSON.stringify(got, null, 2));

// Expected per report-data.sample.json
const expected = { rawScore: 79, correct: 20, percent: 79, kdi: 78, adjusted: 88, potential: 82 };
const checks = Object.entries(expected).map(([k, v]) => `${got[k] === v ? 'PASS' : 'FAIL'} ${k}: got ${got[k]} want ${v}`);
console.log('\n' + checks.join('\n'));
if (checks.some((c) => c.startsWith('FAIL'))) process.exit(1);
