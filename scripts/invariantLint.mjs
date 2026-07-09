/**
 * E4 — invariant-lint. Espejo determinista de los invariantes R1–R14 (CR1).
 *
 * Escanea el CÓDIGO (no docs ni el arnés) en busca de tokens prohibidos por los
 * invariantes y FALLA solo ante violaciones NUEVAS — las violaciones legacy
 * conocidas viven en scripts/legacy-baseline.json (solo-decrecimiento, R-baseline).
 *
 * Uso:
 *   node scripts/invariantLint.mjs                 # gate: falla si hay NUEVAS violaciones
 *   node scripts/invariantLint.mjs --update-baseline  # regenera el baseline desde el código actual
 *   node scripts/invariantLint.mjs --json          # salida JSON
 *
 * Principio norma/check/juicio: la NORMA vive en ceti-invariants.mdc; este es el
 * CHECK mecánico; el JUICIO irreducible lo emiten los agentes D4 (AR/CP).
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, 'scripts', 'legacy-baseline.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update-baseline');
const AS_JSON = args.includes('--json');

// Raíces de código a escanear (el arnés y los docs NO se escanean: describen los
// tokens prohibidos como prohibiciones, no como uso).
const SCAN_ROOTS = ['src', 'app', join('functions', 'src'), 'scripts'];
const SCAN_FILES = ['firestore.rules'];
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.rules']);
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.expo', '.firebase',
  'docs', '.claude', '.cursor', 'content',
]);
const EXCLUDE_FILES = new Set(['invariantLint.mjs', 'legacy-baseline.json']);

// Grupos declarativos: cada uno cita su invariante R y su conflicto de conflictos.md.
const GROUPS = [
  { group: 'studentId', R: 'R1', conflicto: 1,
    re: /\bstudentId\b/,
    msg: 'identidad por uid; prohibido el seudónimo studentId (R1)' },
  { group: 'roles-superadmin', R: 'R3', conflicto: 4,
    re: /isSuperAdmin|CETI_SUPERADMIN|setSuperadmin/,
    msg: '5 roles; admin es claim, no allowlist superadmin (R3)' },
  { group: 'perfilamiento', R: 'R5', conflicto: 2,
    re: /\baiProfile\b/,
    msg: 'sin perfil individual del menor; no aiProfile (R5)' },
  { group: 'acudiente', R: 'R6', conflicto: 6,
    re: /\bautorizaciones\b|acudienteRef|canalEvidencia|setAuthorizationStatus|\bAutorizacion\b/,
    msg: 'atestación ligera; cero PII de acudiente; sin colección autorizaciones (R6)' },
  { group: 'runtime-ia', R: 'R7', conflicto: 7,
    re: /services[\\/]+ai|adaptiveQuiz|adaptQuestion|getRecommendedPath|analyzeWeaknesses|\baiHints\b|\bisAdaptable\b/,
    skipScripts: true,
    msg: 'runtime estático; IA solo authoring-time (R7)' },
  // Acota estructuralmente la excepción RQ-ES10: SDKs/hosts de IA solo en functions/.
  { group: 'ia-cliente', R: 'R7', conflicto: 7,
    re: /@anthropic-ai\/|['"`]openai(?:\/[\w-]+)?['"`]|@google\/gen(?:erative-)?ai|@mistralai\/|\bai-sdk\b|api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|openrouter\.ai/,
    clientOnly: true,
    msg: 'IA solo server-side (functions/) — RQ-ES10; prohibido SDK/fetch de IA en cliente (R7)' },
  { group: 'bancos-global', R: 'R8', conflicto: 8,
    re: /\bquestionBank\b/,
    msg: 'bancos grado×mundo×tipo; sin questionBank global (R8)' },
  { group: 'quiz-tipos', R: 'R9', conflicto: 9,
    re: /\bfill_blank\b|\bcalculation\b/,
    msg: 'tipos MC/VF/ordenar; sin fill_blank/calculation (R9)' },
  { group: 'features-excluidas', R: 'R11', conflicto: 5,
    re: /buildCertificateHtml|\bparentId\b|\bchildId\b|\bfamilyId\b/,
    msg: 'features excluidas: sin certificados PDF ni modelo parent/child/family (R11)' },
];

function walk(dir, acc) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const p = join(dir, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, acc);
    else if (CODE_EXT.has(extname(p)) && !EXCLUDE_FILES.has(name)) acc.push(p);
  }
  return acc;
}

const files = [];
for (const r of SCAN_ROOTS) { if (existsSync(join(ROOT, r))) walk(join(ROOT, r), files); }
for (const f of SCAN_FILES) { if (existsSync(join(ROOT, f))) files.push(join(ROOT, f)); }

const rel = (p) => relative(ROOT, p).split(sep).join('/');

// Recolecta hits por (group, file).
const hits = {}; // key `${group}::${file}` -> { group, R, conflicto, file, count, lines: [] }
for (const file of files) {
  const relPath = rel(file);
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  const lines = src.split(/\r?\n/);
  for (const g of GROUPS) {
    if (g.skipScripts && relPath.startsWith('scripts/')) continue;
    if (g.clientOnly && !(relPath.startsWith('src/') || relPath.startsWith('app/'))) continue;
    for (let i = 0; i < lines.length; i++) {
      if (g.re.test(lines[i])) {
        const key = `${g.group}::${relPath}`;
        if (!hits[key]) hits[key] = { group: g.group, R: g.R, conflicto: g.conflicto, file: relPath, count: 0, lines: [] };
        hits[key].count++;
        hits[key].lines.push(i + 1);
      }
    }
  }
}

if (UPDATE) {
  const entries = Object.values(hits)
    .sort((a, b) => a.group.localeCompare(b.group) || a.file.localeCompare(b.file))
    .map((h) => ({ group: h.group, R: h.R, file: h.file, count: h.count, conflicto: h.conflicto }));
  const baseline = {
    note: 'Baseline de deuda legacy (E4 / CR1). SOLO-DECRECIMIENTO: prohibido agregar entradas. Debe llegar a cero al cerrar el refactor del pivot. Cada entrada cita su conflicto de docs/empresa/conflictos.md.',
    generatedBy: 'scripts/invariantLint.mjs --update-baseline',
    totalEntries: entries.length,
    entries,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`✓ Baseline regenerado: ${entries.length} entradas (${entries.reduce((n, e) => n + e.count, 0)} ocurrencias) → scripts/legacy-baseline.json`);
  process.exit(0);
}

// Carga baseline.
let baseline = { entries: [] };
if (existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch (e) {
    console.error(`✗ No se pudo leer el baseline: ${e.message}`);
    process.exit(2);
  }
}
const baselineMap = new Map();
for (const e of baseline.entries) baselineMap.set(`${e.group}::${e.file}`, e.count);

// Compara: NUEVA violación = (group,file) no listado, o count actual > baseline.
const newViolations = [];
for (const h of Object.values(hits)) {
  const key = `${h.group}::${h.file}`;
  const allowed = baselineMap.get(key) ?? 0;
  if (h.count > allowed) {
    newViolations.push({ ...h, allowed, nuevas: h.count - allowed });
  }
}

if (AS_JSON) {
  console.log(JSON.stringify({ newViolations, scannedFiles: files.length }, null, 2));
  process.exit(newViolations.length ? 1 : 0);
}

if (newViolations.length) {
  console.error(`✗ invariant-lint: ${newViolations.length} grupo(s) con violaciones NUEVAS (no en baseline):\n`);
  for (const v of newViolations.sort((a, b) => a.file.localeCompare(b.file))) {
    const g = GROUPS.find((x) => x.group === v.group);
    console.error(`  [${v.R} ${v.group}] ${v.file}: ${v.nuevas} nueva(s) (baseline ${v.allowed}, ahora ${v.count}) líneas ${v.lines.slice(0, 8).join(',')}`);
    console.error(`      → ${g?.msg}`);
  }
  console.error('\nArregla la violación (no la agregues al baseline: es solo-decrecimiento, R-baseline en CR1).');
  process.exit(1);
}

const totalLegacy = Object.values(hits).reduce((n, h) => n + h.count, 0);
console.log(`✓ invariant-lint: sin violaciones nuevas. (${files.length} archivos; ${totalLegacy} ocurrencias legacy bajo baseline de ${baseline.entries.length} entradas.)`);
process.exit(0);
