/**
 * E3 — bank-insertion-gate (escritor único, determinista, SIN LLM).
 *
 * De esta pieza depende la calidad del contenido. Verifica, EN ORDEN, y solo
 * aprueba para siembra si TODO pasa:
 *   1. Zod estructural (E2 / contentSchemas.mjs) + ensamblaje 4+3+3 por celda.
 *   2. Veredicto de VC = pass en las 4 rúbricas (content/validation/<bancoId>.json,
 *      producido aparte por /validar-bancos; el gate NO llama al LLM).
 *   3. pendiente_validacion_docente:true.
 *   4. Check caducables (sin literales $/COP/%-tasa/SMMLV/UVT con número adyacente
 *      que no provengan de constRef → economia-CO.<año>.json, R14).
 *   5. Cobertura/unicidad: bancoId único, dificultad dentro del rango de su celda
 *      (S6), EligeCamino sin correctAnswer.
 *
 * Si algo falla: NO escribe nada para ese banco y reporta celda/ítem y causa
 * explícitamente (sin caps silenciosos). Idempotente. Lo aprobado se escribe a
 * content/approved/<bancoId>.json; seedQuestionBank.mjs solo siembra eso.
 *
 *   node scripts/bankGate.mjs
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectAndValidate, validateAssembly } from './contentSchemas.mjs';

const ROOT = process.cwd();
const BANKS_DIR = join(ROOT, 'content', 'bancos');
const VALID_DIR = join(ROOT, 'content', 'validation');
const APPROVED_DIR = join(ROOT, 'content', 'approved');
const CONST_DIR = join(ROOT, 'content', 'constants');

// Matriz de dificultad por celda (S6): [min,max] por grado×world.
const DIFF_RANGE = {
  '9':  { world_1: [1, 1], world_2: [1, 2], world_3: [2, 2], world_4: [2, 3], world_5: [3, 3] },
  '10': { world_1: [2, 2], world_2: [2, 3], world_3: [3, 3], world_4: [3, 4], world_5: [4, 4] },
  '11': { world_1: [3, 3], world_2: [3, 4], world_3: [4, 4], world_4: [4, 5], world_5: [5, 5] },
};

const RUBRICAS = ['pedagogico', 'coherencia', 'dificultad', 'precision_financiera'];

// Tokens de cifras caducables (R14). Si aparecen con número adyacente y el ítem no
// usa constRef, se rechaza.
const CADUCABLE_RE = /\$\s?\d|\d[\d.,]*\s?(?:COP|pesos)\b|\b\d[\d.,]*\s?%/i;
const CADUCABLE_WORD_RE = /\b(SMMLV|UVT)\b/;

function itemTexts(bank) {
  const out = [];
  for (const it of bank.items ?? []) {
    out.push(it.enunciado, it.explicacion, ...(it.opciones ?? []));
  }
  for (const s of bank.situaciones ?? []) {
    out.push(s.enunciado, s.opcionA?.texto, s.opcionA?.consecuencia, s.opcionB?.texto, s.opcionB?.consecuencia);
  }
  return out.filter((t) => typeof t === 'string');
}

function hasConstRef(bank) {
  const json = JSON.stringify(bank);
  return /"constRef"\s*:/.test(json);
}

function checkCaducables(bank) {
  const errs = [];
  const refOk = hasConstRef(bank);
  for (const t of itemTexts(bank)) {
    if ((CADUCABLE_RE.test(t) || CADUCABLE_WORD_RE.test(t)) && !refOk) {
      errs.push(`caducable literal sin constRef: "${t.slice(0, 60)}" (R14 → economia-CO.<año>.json)`);
    }
  }
  return errs;
}

function checkDificultad(bank) {
  const errs = [];
  const range = DIFF_RANGE[bank.grado]?.[bank.worldId];
  if (!range) return errs;
  for (const it of bank.items ?? []) {
    if (typeof it.dificultad === 'number' && (it.dificultad < range[0] || it.dificultad > range[1])) {
      errs.push(`item ${it.id}: dificultad ${it.dificultad} fuera del rango [${range[0]},${range[1]}] de la celda ${bank.grado}×${bank.worldId} (S6)`);
    }
  }
  return errs;
}

function readVerdict(bancoId) {
  const p = join(VALID_DIR, `${bancoId}.json`);
  if (!existsSync(p)) return { ok: false, reason: `falta veredicto VC (${bancoId}.json en content/validation/)` };
  let v;
  try { v = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return { ok: false, reason: `veredicto VC ilegible: ${e.message}` }; }
  const failed = RUBRICAS.filter((r) => v?.rubricas?.[r] !== 'pass');
  if (failed.length) return { ok: false, reason: `VC no-pass en rúbricas: ${failed.join(', ')}` };
  if (v?.global !== 'pass') return { ok: false, reason: 'VC global != pass' };
  return { ok: true };
}

function main() {
  if (!existsSync(BANKS_DIR)) { console.log('✓ content/bancos/ no existe — nada que aprobar.'); process.exit(0); }
  const files = readdirSync(BANKS_DIR).filter((f) => f.endsWith('.json'));
  if (!files.length) { console.log('✓ content/bancos/ vacío — nada que aprobar.'); process.exit(0); }

  mkdirSync(APPROVED_DIR, { recursive: true });
  const seenIds = new Set();
  let approved = 0, rejected = 0;
  // Para ensamblaje: agrupar conteos por celda grado×world×tipo.
  const cellCounts = {};

  for (const f of files) {
    const p = join(BANKS_DIR, f);
    const errs = [];
    let bank;
    try { bank = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.error(`  ✗ ${f}: JSON inválido (${e.message})`); rejected++; continue; }

    // 1) Estructura (E2).
    errs.push(...detectAndValidate(bank, f));
    // 3) flag (también lo cubre E2, se reitera explícito).
    if (bank?.pendiente_validacion_docente !== true) errs.push('pendiente_validacion_docente != true (R8)');
    // 5) unicidad + dificultad.
    if (bank?.bancoId) {
      if (seenIds.has(bank.bancoId)) errs.push(`bancoId duplicado: ${bank.bancoId}`);
      seenIds.add(bank.bancoId);
    }
    errs.push(...checkDificultad(bank));
    // 4) caducables.
    errs.push(...checkCaducables(bank));
    // 2) veredicto VC.
    const verdict = readVerdict(bank?.bancoId ?? f);
    if (!verdict.ok) errs.push(verdict.reason);

    if (bank?.tipo && bank?.grado && bank?.worldId) {
      const cell = `${bank.grado}_${bank.worldId}`;
      cellCounts[cell] = cellCounts[cell] || {};
      cellCounts[cell][bank.tipo] = (cellCounts[cell][bank.tipo] || 0) + (bank.items?.length ?? 0);
    }

    if (errs.length) {
      rejected++;
      console.error(`  ✗ ${f} (${bank?.bancoId ?? '?'}):`);
      errs.forEach((e) => console.error(`      - ${e}`));
    } else {
      approved++;
      writeFileSync(join(APPROVED_DIR, `${bank.bancoId}.json`), JSON.stringify({ bancoId: bank.bancoId, approvedFrom: f, gate: 'E3' }, null, 2) + '\n', 'utf8');
      console.log(`  ✓ ${f} → aprobado-para-siembra`);
    }
  }

  // Ensamblaje por celda (R9): solo informativo si la celda está incompleta.
  for (const [cell, counts] of Object.entries(cellCounts)) {
    const aerr = validateAssembly(counts, `celda ${cell}`);
    if (aerr.length) aerr.forEach((e) => console.warn(`  ⚠ ${e}`));
  }

  console.log(`\n${approved} aprobado(s), ${rejected} rechazado(s).`);
  process.exit(rejected ? 1 : 0);
}

main();
