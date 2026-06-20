/**
 * E12 — content-coverage-gate (cobertura, no solo estructura).
 *
 * Por qué existe: los gates estructurales (E2/E3) corren sobre lo que HAY en
 * content/bancos/ y dan "verde" cuando el directorio está vacío. Eso permitió
 * que el estado del proyecto afirmara "450 ítems generados" mientras el runtime
 * no tenía contenido real — verde falso. Este gate cierra ese hueco: exige que
 * el universo COMPLETO de celdas del runtime exista, esté aprobado (E3) y tenga
 * veredicto VC = pass. Si falta una sola celda, falla con la lista exacta.
 *
 *   node scripts/contentCoverageGate.mjs
 *
 * Universo (R8/R9): grado{9,10,11} × world_{1..5} × tipo{multiple_choice,
 * true_false,ordenar} = 45 bancos. Cada uno: manifiesto en content/approved/,
 * fuente real en content/bancos/ con >= minItems, y content/validation/<id>.json
 * con las 4 rúbricas + global en pass.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const APPROVED = join(ROOT, 'content', 'approved');
const BANKS = join(ROOT, 'content', 'bancos');
const VALID = join(ROOT, 'content', 'validation');

const GRADOS = ['9', '10', '11'];
const WORLDS = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];
const TIPOS = ['multiple_choice', 'true_false', 'ordenar'];
const MIN_ITEMS = { multiple_choice: 4, true_false: 3, ordenar: 3 };
const RUBRICAS = ['pedagogico', 'coherencia', 'dificultad', 'precision_financiera'];

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function checkCell(grado, worldId, tipo) {
  const id = `${grado}_${worldId}_${tipo}`;
  const errs = [];

  // 1) aprobado-para-siembra (E3 manifest)
  const manifest = readJson(join(APPROVED, `${id}.json`));
  if (!manifest) errs.push(`falta manifiesto aprobado content/approved/${id}.json (no pasó E3)`);

  // 2) fuente real con suficientes items
  const src = readJson(join(BANKS, `${id}.json`));
  if (!src) {
    errs.push(`falta contenido real content/bancos/${id}.json`);
  } else {
    const n = Array.isArray(src.items) ? src.items.length : 0;
    if (n < MIN_ITEMS[tipo]) errs.push(`${id}: ${n} ítems (< mínimo ${MIN_ITEMS[tipo]} para ensamblar)`);
  }

  // 3) veredicto VC = pass en las 4 rúbricas + global
  const v = readJson(join(VALID, `${id}.json`));
  if (!v) errs.push(`falta veredicto VC content/validation/${id}.json`);
  else {
    const bad = RUBRICAS.filter((r) => v?.rubricas?.[r] !== 'pass');
    if (bad.length) errs.push(`${id}: VC no-pass en ${bad.join(', ')}`);
    if (v?.global !== 'pass') errs.push(`${id}: VC global != pass`);
  }
  return errs;
}

function main() {
  if (!existsSync(BANKS) || !existsSync(APPROVED)) {
    console.error('✗ content/bancos o content/approved no existen — cobertura 0/45.');
    process.exit(1);
  }
  let missingCells = 0;
  const allErrs = [];
  for (const g of GRADOS)
    for (const w of WORLDS)
      for (const t of TIPOS) {
        const errs = checkCell(g, w, t);
        if (errs.length) {
          missingCells++;
          allErrs.push(...errs);
        }
      }

  const total = GRADOS.length * WORLDS.length * TIPOS.length;
  const ok = total - missingCells;
  if (allErrs.length) {
    console.error(`✗ Cobertura de contenido incompleta: ${ok}/${total} bancos listos.`);
    allErrs.forEach((e) => console.error(`    - ${e}`));
    console.error(
      `\nEl runtime sirve grado×mundo×tipo (R8/R9); cada celda debe existir, estar aprobada (E3) y validada (VC).`
    );
    process.exit(1);
  }
  console.log(`✓ content-coverage: ${ok}/${total} bancos presentes, aprobados y validados (45 = 3×5×3).`);
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
