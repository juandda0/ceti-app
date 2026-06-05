/**
 * E8 — rq-citation-check. El mensaje de commit (o cuerpo de PR) debe citar un
 * RQ-id válido y existente en docs/requerimientos.md (R13).
 *
 * Uso (hook commit-msg de husky): node scripts/rqCitationCheck.mjs "$1"
 *   - arg = ruta al archivo del mensaje de commit (.git/COMMIT_EDITMSG).
 *   - sin arg: usa el último commit (git log -1).
 *
 * Exento (no requieren RQ): commits de infraestructura/chore/docs/ci/build/style,
 * merges, reverts, o que contengan [skip-rq]. El resto sin RQ-id válido → falla.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const RQ_RE = /\bRQ-[A-Z]{2}\d{2}\b/g;
const EXEMPT_PREFIX = /^(chore|docs|ci|build|style|merge|revert)(\(|:|\s)/i;

function getMessage() {
  const arg = process.argv[2];
  if (arg && existsSync(arg)) return readFileSync(arg, 'utf8');
  try { return execSync('git log -1 --pretty=%B', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
  catch { return ''; }
}

function validRqIds() {
  const p = join(process.cwd(), 'docs', 'requerimientos.md');
  if (!existsSync(p)) return null; // sin spec no podemos validar
  const txt = readFileSync(p, 'utf8');
  const ids = new Set();
  let m;
  const re = new RegExp(RQ_RE.source, 'g');
  while ((m = re.exec(txt))) ids.add(m[0]);
  return ids;
}

const msg = getMessage().trim();
const firstLine = msg.split(/\r?\n/)[0] || '';

if (!msg) { console.log('✓ rq-citation: sin mensaje que verificar.'); process.exit(0); }
if (msg.includes('[skip-rq]') || EXEMPT_PREFIX.test(firstLine.trim()) || /^Merge\b/.test(firstLine)) {
  console.log('✓ rq-citation: commit exento (infra/chore/merge/[skip-rq]).');
  process.exit(0);
}

const cited = msg.match(RQ_RE) || [];
if (!cited.length) {
  console.error('✗ rq-citation: el commit no cita ningún RQ-id (R13).');
  console.error('  Añade el RQ que justifica el trabajo (p. ej. "feat: ... (RQ-FN02)") o usa [skip-rq] para infra.');
  process.exit(1);
}

const valid = validRqIds();
if (valid === null) {
  console.log(`✓ rq-citation: cita ${cited.join(', ')} (no se pudo abrir requerimientos.md para validar existencia).`);
  process.exit(0);
}
const unknown = [...new Set(cited)].filter((id) => !valid.has(id));
if (unknown.length) {
  console.error(`✗ rq-citation: RQ-id inexistente(s) en requerimientos.md: ${unknown.join(', ')}`);
  process.exit(1);
}
console.log(`✓ rq-citation: ${[...new Set(cited)].join(', ')} válido(s).`);
process.exit(0);
