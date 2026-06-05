/**
 * E6 — eval-validador (gate de calidad de VC; C3-matiz).
 *
 * Corre el validador sobre el SET DORADO y compara el modo HÍBRIDO (1 agente
 * multi-rúbrica) vs. 4 VALIDADORES por dimensión separados, midiendo si el híbrido
 * deja pasar errores que los separados atrapan (pérdida de recall).
 *
 * Estructura (la llena el usuario):
 *   content/eval/golden/<caso>.json = {
 *     bancoId, input (banco), expected_verdict: "pass"|"fail",
 *     rationale, verdict_hybrid?: "pass"|"fail", verdict_4dim?: "pass"|"fail" }
 *
 * El runner es determinista: NO llama al LLM. Lee los veredictos ya producidos
 * (verdict_hybrid / verdict_4dim por caso). Reporta
 * precision/recall por modo y la brecha; si el híbrido pierde recall vs 4-dim,
 * marca REGRESIÓN y recomienda escalar a validadores separados en precisión
 * financiera y pedagógico.
 *
 *   node scripts/evalValidador.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GOLDEN_DIR = join(process.cwd(), 'content', 'eval', 'golden');

function metrics(cases, key) {
  // positivo = "fail" (el validador debe DETECTAR el banco malo).
  let tp = 0, fp = 0, fn = 0, tn = 0, n = 0;
  for (const c of cases) {
    const pred = c[key];
    if (pred !== 'pass' && pred !== 'fail') continue; // sin veredicto para este modo
    n++;
    const expectedFail = c.expected_verdict === 'fail';
    const predFail = pred === 'fail';
    if (expectedFail && predFail) tp++;
    else if (!expectedFail && predFail) fp++;
    else if (expectedFail && !predFail) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  return { n, tp, fp, fn, tn, precision, recall };
}

function fmt(x) { return x === null ? 'n/a' : x.toFixed(3); }

if (!existsSync(GOLDEN_DIR)) {
  console.log('✓ content/eval/golden/ aún no existe — 0 casos. Llena el set dorado para activar E6.');
  process.exit(0);
}
const files = readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
if (!files.length) {
  console.log('✓ set dorado vacío — 0 casos. Llena content/eval/golden/ (ver _example.json).');
  process.exit(0);
}

const cases = [];
for (const f of files) {
  try { cases.push(JSON.parse(readFileSync(join(GOLDEN_DIR, f), 'utf8'))); }
  catch (e) { console.error(`  ✗ ${f}: JSON inválido (${e.message})`); }
}

const hybrid = metrics(cases, 'verdict_hybrid');
const fourdim = metrics(cases, 'verdict_4dim');

console.log(`Set dorado: ${cases.length} caso(s).`);
console.log(`  híbrido : n=${hybrid.n} precision=${fmt(hybrid.precision)} recall=${fmt(hybrid.recall)}`);
console.log(`  4-dim   : n=${fourdim.n} precision=${fmt(fourdim.precision)} recall=${fmt(fourdim.recall)}`);

// Regresión: el híbrido pierde recall frente a los validadores separados.
if (hybrid.recall !== null && fourdim.recall !== null && hybrid.recall < fourdim.recall) {
  console.error(`\n✗ REGRESIÓN: recall híbrido (${fmt(hybrid.recall)}) < recall 4-dim (${fmt(fourdim.recall)}).`);
  console.error('  El híbrido deja pasar errores que los separados atrapan (C3-matiz).');
  console.error('  → Escalar a validadores separados al menos en precisión financiera y pedagógico.');
  process.exit(1);
}

if (hybrid.n === 0 && fourdim.n === 0) {
  console.log('\n(Casos sin veredictos verdict_hybrid/verdict_4dim — añádelos para medir la brecha.)');
}
console.log('\n✓ Sin regresión del híbrido frente a 4-dim.');
process.exit(0);
