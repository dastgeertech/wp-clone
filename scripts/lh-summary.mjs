/** One-off: print Lighthouse category scores + Core Web Vitals from a report. */
import { readFileSync } from 'node:fs';

const r = JSON.parse(readFileSync(process.argv[2] ?? 'lighthouse-report.json', 'utf8'));
console.log('URL:', r.finalUrl);
for (const [key, cat] of Object.entries(r.categories)) {
  console.log(`${cat.title.padEnd(20)} ${Math.round((cat.score ?? 0) * 100)}`);
}
const a = r.audits;
const m = (id) => a[id]?.displayValue ?? 'n/a';
console.log('--- metrics ---');
console.log('FCP ', m('first-contentful-paint'));
console.log('LCP ', m('largest-contentful-paint'));
console.log('CLS ', m('cumulative-layout-shift'));
console.log('TBT ', m('total-blocking-time'));
console.log('INP ', m('interaction-to-next-paint'));
console.log('SI  ', m('speed-index'));
console.log('HTML', m('total-byte-weight'));
console.log('--- failed binary audits ---');
for (const [id, audit] of Object.entries(a)) {
  if (audit.score !== null && audit.score !== undefined && audit.score < 1 &&
      (audit.scoreDisplayMode === 'binary' || audit.scoreDisplayMode === 'metricSavings') &&
      audit.title && !id.startsWith('group')) {
    console.log(`  ${String(audit.score).padEnd(5)} ${id} — ${audit.title}`);
  }
}
