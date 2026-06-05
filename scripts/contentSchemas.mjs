/**
 * E2 — content schemas (Zod). Validación estructural del contenido contra los
 * schemas de la skill `content-schemas` (S5) + ensamblaje del quiz
 * 4 MC + 3 V/F + 3 ordenar = 10 (R9).
 *
 * Zod cubre la forma per-campo (tipos, rangos, enums, longitudes); los chequeos
 * cross-campo (permutación de ordenCanonico, bancoId == grado_world_tipo, minItems
 * por tipo, EligeCamino sin correctAnswer/puntaje) van en JS para ser robustos
 * entre versiones de zod. Exporta funciones para que E3 (bankGate) las reúse, y
 * corre como CLI sobre content/bancos/:
 *   node scripts/contentSchemas.mjs
 *
 * Sale ≠0 si algún archivo viola el schema. Bloqueante vía E3 / CI (E10).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const GRADOS = ['9', '10', '11'];
const WORLDS = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];
const TIPOS = ['multiple_choice', 'true_false', 'ordenar'];
const MIN_ITEMS = { multiple_choice: 4, true_false: 3, ordenar: 3 };

// ---- Schemas zod (forma per-campo) -----------------------------------------
const dificultad = z.number().int().min(1).max(5);
const baseItem = { id: z.string().min(1), enunciado: z.string().min(1), competencia: z.string().min(1), dificultad, explicacion: z.string().optional() };

const MultipleChoiceItem = z.object({ ...baseItem, opciones: z.array(z.string().min(1)).length(4), correctIndex: z.number().int().min(0).max(3) });
const TrueFalseItem = z.object({ ...baseItem, respuesta: z.boolean() });
const OrdenarItem = z.object({ ...baseItem, elementos: z.array(z.string().min(1)).min(3).max(6), ordenCanonico: z.array(z.number().int()) });

const ITEM_SCHEMAS = { multiple_choice: MultipleChoiceItem, true_false: TrueFalseItem, ordenar: OrdenarItem };

const QuizBankShape = z.object({
  bancoId: z.string().min(1),
  grado: z.enum(GRADOS),
  worldId: z.enum(WORLDS),
  tipo: z.enum(TIPOS),
  items: z.array(z.unknown()).min(1),
  pendiente_validacion_docente: z.literal(true),
  generadoPor: z.literal('ia'),
  version: z.number().int(),
});

const EligeSituacion = z.object({
  id: z.string().min(1),
  enunciado: z.string().min(1),
  opcionA: z.object({ texto: z.string().min(1), consecuencia: z.string().min(1) }),
  opcionB: z.object({ texto: z.string().min(1), consecuencia: z.string().min(1) }),
});
const EligeCaminoShape = z.object({
  bancoId: z.string().min(1),
  grado: z.enum(GRADOS),
  worldId: z.enum(WORLDS),
  situaciones: z.array(z.unknown()).min(1),
  pendiente_validacion_docente: z.literal(true),
});

// ---- Helpers ----------------------------------------------------------------
function zodErrs(result, ctx) {
  if (result.success) return [];
  return result.error.issues.map((i) => `${ctx}${i.path.length ? '.' + i.path.join('.') : ''}: ${i.message}`);
}

function isPermutation(arr, n) {
  if (!Array.isArray(arr) || arr.length !== n) return false;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted.every((v, i) => v === i);
}

// ---- Validadores públicos (devuelven string[]) ------------------------------
export function validateQuizBank(bank, ctx = 'banco') {
  const errs = zodErrs(QuizBankShape.safeParse(bank), ctx);
  if (bank?.bancoId && bank?.grado && bank?.worldId && bank?.tipo) {
    const expected = `${bank.grado}_${bank.worldId}_${bank.tipo}`;
    if (bank.bancoId !== expected) errs.push(`${ctx}: bancoId debe ser ${expected} (es ${bank.bancoId})`);
  }
  const schema = ITEM_SCHEMAS[bank?.tipo];
  if (schema && Array.isArray(bank?.items)) {
    bank.items.forEach((it, i) => {
      errs.push(...zodErrs(schema.safeParse(it), `${ctx}.items[${i}]`));
      if (bank.tipo === 'ordenar' && Array.isArray(it?.elementos) && !isPermutation(it?.ordenCanonico, it.elementos.length)) {
        errs.push(`${ctx}.items[${i}]: ordenCanonico debe ser permutación de índices 0..${it.elementos.length - 1}`);
      }
    });
    const min = MIN_ITEMS[bank.tipo];
    if (min && bank.items.length < min) errs.push(`${ctx}: minItems para ${bank.tipo} es ${min} (tiene ${bank.items.length})`);
  }
  return errs;
}

export function validateEligeCaminoBank(bank, ctx = 'eligeCamino') {
  const errs = zodErrs(EligeCaminoShape.safeParse(bank), ctx);
  if (bank?.grado && bank?.worldId && bank?.bancoId !== `${bank.grado}_${bank.worldId}`) {
    errs.push(`${ctx}: bancoId debe ser ${bank?.grado}_${bank?.worldId}`);
  }
  if (Array.isArray(bank?.situaciones)) {
    bank.situaciones.forEach((s, i) => {
      const c = `${ctx}.situaciones[${i}]`;
      errs.push(...zodErrs(EligeSituacion.safeParse(s), c));
      if (s && ('correctAnswer' in s || 'puntaje' in s)) errs.push(`${c}: EligeCamino sin correctAnswer ni puntaje (R5)`);
    });
  }
  return errs;
}

/** Ensamblaje del quiz (R9): exactamente 4 MC + 3 V/F + 3 ordenar = 10. */
export function validateAssembly(counts, ctx = 'assembly') {
  const errs = [];
  const want = { multiple_choice: 4, true_false: 3, ordenar: 3 };
  for (const t of TIPOS) {
    const n = counts[t] ?? 0;
    if (n < want[t]) errs.push(`${ctx}: faltan ${t} para ensamblar (necesita ${want[t]}, banco aporta ${n})`);
  }
  return errs;
}

export function detectAndValidate(bank, file) {
  const ctx = basename(file);
  if (bank?.situaciones || (bank?.bancoId && /^\d+_world_\d+$/.test(bank.bancoId))) {
    return validateEligeCaminoBank(bank, ctx);
  }
  return validateQuizBank(bank, ctx);
}

function main() {
  const dir = join(process.cwd(), 'content', 'bancos');
  if (!existsSync(dir)) { console.log('✓ content/bancos/ aún no existe — 0 bancos que validar.'); process.exit(0); }
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!files.length) { console.log('✓ content/bancos/ vacío — 0 bancos que validar.'); process.exit(0); }
  let failed = 0;
  for (const f of files) {
    let bank;
    try { bank = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch (e) { console.error(`  ✗ ${f}: JSON inválido (${e.message})`); failed++; continue; }
    const errs = detectAndValidate(bank, f);
    if (errs.length) { failed++; console.error(`  ✗ ${f}:`); errs.forEach((e) => console.error(`      - ${e}`)); }
    else console.log(`  ✓ ${f}`);
  }
  console.log(`\n${files.length - failed}/${files.length} bancos válidos.`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
