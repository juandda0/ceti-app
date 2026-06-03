/**
 * Static i18n key checker. Scans src for static `t('a.b.c')` / t("a.b.c")
 * literals and verifies each exists in the es.json catalog. Dynamic keys
 * (template literals with ${...}) are skipped and listed for manual review.
 *
 * Exits non-zero if any static key is missing. Run: node scripts/checkI18nKeys.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const catalog = JSON.parse(readFileSync(join(ROOT, 'src/shared/i18n/locales/es.json'), 'utf8'));

const known = new Set();
(function flatten(obj, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key);
    else known.add(key);
  }
})(catalog, '');

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(p, acc);
    } else if (['.ts', '.tsx'].includes(extname(p)) && !/\.test\.(ts|tsx)$/.test(p)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(join(ROOT, 'src'), []);
// Static keys only: t('a.b') or t("a.b"); skip t(`...${x}`).
const STATIC = /\bt\(\s*(['"])([a-zA-Z0-9_.]+)\1/g;
const DYNAMIC = /\bt\(\s*`/g;

const missing = [];
let dynamicCount = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let m;
  while ((m = STATIC.exec(src))) {
    const key = m[2];
    if (!known.has(key)) missing.push({ file: f.replace(ROOT + '\\', '').replace(ROOT + '/', ''), key });
  }
  const d = src.match(DYNAMIC);
  if (d) dynamicCount += d.length;
}

if (missing.length) {
  console.error(`✗ ${missing.length} missing i18n key(s):`);
  for (const { file, key } of missing) console.error(`   ${key}  (${file})`);
  console.error(`\n(${dynamicCount} dynamic t(\`...\`) call(s) skipped — review manually.)`);
  process.exit(1);
}
console.log(`✓ All static i18n keys resolve. (${dynamicCount} dynamic key call(s) skipped.)`);
process.exit(0);
