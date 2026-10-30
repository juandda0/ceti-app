/**
 * Validación del contenido por defecto de Ceti (content/bancos, content/microteoria):
 * forma, ensamblaje y etiquetas del MEN. Reemplaza los gates E2/E3/E12 que se
 * retiraron con el arnés, y la usa la prueba `contenidoBancos.test.ts` sobre
 * todo content/ (y `node scripts/contenido/validar.cjs` a mano). Puro.
 *
 * Fase 7: cada pregunta lleva su ámbito (`ambito`, uno de los del mundo) y su
 * desempeño del MEN (`desempeno`, del grupo de grados del banco). Cada banco de
 * opción múltiple aparta 2 preguntas `prueba: true` para la prueba de entrada y
 * salida: no salen en las lecciones ni en el jefe.
 */
import {
  ALINEACION_MEN,
  desempenoMen,
  grupoGradoMen,
} from '@/functions/src/educadores/dominio';
import { SEEDED_GRADOS } from './quiz.types';

export const MUNDOS_CONTENIDO = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5', 'world_6'] as const;
export const TIPOS_CONTENIDO = ['multiple_choice', 'true_false', 'ordenar'] as const;
type TipoContenido = (typeof TIPOS_CONTENIDO)[number];

/** Competencia de Ceti de cada mundo (los ids estables de competencias.ts). */
export const COMPETENCIA_DE_MUNDO: Record<(typeof MUNDOS_CONTENIDO)[number], string> = {
  world_1: 'ingreso',
  world_2: 'presupuesto',
  world_3: 'ahorro',
  world_4: 'credito',
  world_5: 'deuda',
  world_6: 'economia',
};

/** Mínimos por banco: 8 + 2 de prueba, 6 y 6 (alcanza para 4 + 3 + 3 y para variar). */
export const MINIMOS = { multiple_choice: 8, true_false: 6, ordenar: 6 } as const;
export const PREGUNTAS_PRUEBA = 2;
export const SITUACIONES = 3;

/**
 * Largo máximo de los textos por banco de grado: en 1°–3° casi no hay lectura
 * larga, y en 4°–5° todavía poca. 0 = sin tope.
 */
export const TOPES: Record<string, { enunciado: number; opcion: number; teoria: number; situacion: number }> = {
  '1': { enunciado: 110, opcion: 40, teoria: 200, situacion: 150 },
  '4': { enunciado: 170, opcion: 70, teoria: 320, situacion: 230 },
};

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function esPermutacion(a: unknown, n: number): boolean {
  return Array.isArray(a) && a.length === n && [...a].sort((x, y) => x - y).every((v, i) => v === i);
}

function largo(errs: string[], ctx: string, texto: unknown, tope: number | undefined) {
  if (tope && typeof texto === 'string' && texto.length > tope) {
    errs.push(`${ctx}: ${texto.length} caracteres, el tope del grado es ${tope}`);
  }
}

interface Banco {
  bancoId?: unknown;
  grado?: unknown;
  worldId?: unknown;
  tipo?: unknown;
  version?: unknown;
  generadoPor?: unknown;
  pendiente_validacion_docente?: unknown;
  items?: unknown;
}

export function validarBancoQuiz(b: Banco, ctx = 'banco'): string[] {
  const errs: string[] = [];
  const grado = String(b.grado ?? '');
  const mundo = String(b.worldId ?? '') as (typeof MUNDOS_CONTENIDO)[number];
  const tipo = String(b.tipo ?? '') as TipoContenido;
  if (!(SEEDED_GRADOS as readonly string[]).includes(grado)) errs.push(`${ctx}: grado ${grado} no tiene banco`);
  if (!MUNDOS_CONTENIDO.includes(mundo)) errs.push(`${ctx}: mundo ${mundo} desconocido`);
  if (!TIPOS_CONTENIDO.includes(tipo)) errs.push(`${ctx}: tipo ${tipo} desconocido`);
  if (b.bancoId !== `${grado}_${mundo}_${tipo}`) errs.push(`${ctx}: bancoId debe ser ${grado}_${mundo}_${tipo}`);
  if (b.generadoPor !== 'ia') errs.push(`${ctx}: generadoPor debe ser 'ia'`);
  if (b.pendiente_validacion_docente !== true) errs.push(`${ctx}: pendiente_validacion_docente debe ser true`);
  if (!Number.isInteger(b.version)) errs.push(`${ctx}: version entera`);
  if (!Array.isArray(b.items)) return [...errs, `${ctx}: items debe ser una lista`];
  if (errs.length) return errs;

  const grupo = grupoGradoMen(grado);
  const ambitosMundo = ALINEACION_MEN[COMPETENCIA_DE_MUNDO[mundo]].ambitos as readonly string[];
  const tope = TOPES[grado];
  const ids = new Set<string>();
  const enunciados = new Set<string>();
  let prueba = 0;
  (b.items as Record<string, unknown>[]).forEach((it, i) => {
    const c = `${ctx}.items[${i}]`;
    if (!it || typeof it !== 'object') return errs.push(`${c}: no es un objeto`);
    if (!esTexto(it.id) || !String(it.id).startsWith(`${b.bancoId}_`)) errs.push(`${c}: id debe empezar por ${b.bancoId}_`);
    if (ids.has(String(it.id))) errs.push(`${c}: id repetido ${it.id}`);
    ids.add(String(it.id));
    if (!esTexto(it.enunciado)) errs.push(`${c}: enunciado vacío`);
    const clave = String(it.enunciado ?? '').trim().toLowerCase();
    if (enunciados.has(clave)) errs.push(`${c}: enunciado repetido en el banco`);
    enunciados.add(clave);
    largo(errs, `${c}.enunciado`, it.enunciado, tope?.enunciado);
    if (it.competencia !== COMPETENCIA_DE_MUNDO[mundo]) errs.push(`${c}: competencia debe ser ${COMPETENCIA_DE_MUNDO[mundo]}`);
    if (!Number.isInteger(it.dificultad) || (it.dificultad as number) < 1 || (it.dificultad as number) > 5) errs.push(`${c}: dificultad 1..5`);
    if (!esTexto(it.explicacion)) errs.push(`${c}: falta la explicación`);
    if (!ambitosMundo.includes(String(it.ambito))) errs.push(`${c}: ambito ${it.ambito} no es del mundo (${ambitosMundo.join(', ')})`);
    const d = desempenoMen(String(it.desempeno ?? ''));
    if (!d) errs.push(`${c}: desempeno ${it.desempeno} no existe`);
    else {
      if (d.grupo !== grupo) errs.push(`${c}: desempeno ${d.id} es de ${d.grupo}, el banco es de ${grupo}`);
      if (d.ambito !== it.ambito) errs.push(`${c}: desempeno ${d.id} es del ámbito ${d.ambito}, no de ${it.ambito}`);
    }
    if ('prueba' in it) {
      if (tipo !== 'multiple_choice' || it.prueba !== true) errs.push(`${c}: prueba solo vale true y en opción múltiple`);
      else prueba += 1;
    }
    if (tipo === 'multiple_choice') {
      const o = it.opciones;
      if (!Array.isArray(o) || o.length !== 4 || !o.every(esTexto)) errs.push(`${c}: 4 opciones con texto`);
      else {
        if (new Set(o.map((x: string) => x.trim().toLowerCase())).size !== 4) errs.push(`${c}: opciones repetidas`);
        o.forEach((x: string, k: number) => largo(errs, `${c}.opciones[${k}]`, x, tope?.opcion));
      }
      if (!Number.isInteger(it.correctIndex) || (it.correctIndex as number) < 0 || (it.correctIndex as number) > 3) errs.push(`${c}: correctIndex 0..3`);
    } else if (tipo === 'true_false') {
      if (typeof it.respuesta !== 'boolean') errs.push(`${c}: respuesta booleana`);
    } else {
      const e = it.elementos;
      if (!Array.isArray(e) || e.length < 3 || e.length > 6 || !e.every(esTexto)) errs.push(`${c}: 3 a 6 elementos con texto`);
      else {
        if (!esPermutacion(it.ordenCanonico, e.length)) errs.push(`${c}: ordenCanonico debe ser permutación de 0..${e.length - 1}`);
        if (grado === '1' && e.length !== 3) errs.push(`${c}: en 1°–3° se ordenan 3 elementos`);
        e.forEach((x: string, k: number) => largo(errs, `${c}.elementos[${k}]`, x, tope?.opcion));
      }
    }
  });
  const regulares = (b.items as unknown[]).length - prueba;
  if (regulares < MINIMOS[tipo]) errs.push(`${ctx}: ${regulares} preguntas para jugar, mínimo ${MINIMOS[tipo]}`);
  if (tipo === 'multiple_choice' && prueba !== PREGUNTAS_PRUEBA) errs.push(`${ctx}: ${prueba} preguntas de prueba, deben ser ${PREGUNTAS_PRUEBA}`);
  return errs;
}

export function validarEligeCamino(b: Record<string, unknown>, ctx = 'eligeCamino'): string[] {
  const errs: string[] = [];
  const grado = String(b.grado ?? '');
  if (b.bancoId !== `${grado}_${b.worldId}`) errs.push(`${ctx}: bancoId debe ser ${grado}_${b.worldId}`);
  if (!MUNDOS_CONTENIDO.includes(b.worldId as never)) errs.push(`${ctx}: mundo desconocido`);
  if (b.pendiente_validacion_docente !== true) errs.push(`${ctx}: pendiente_validacion_docente debe ser true`);
  const s = b.situaciones;
  if (!Array.isArray(s) || s.length < SITUACIONES) return [...errs, `${ctx}: mínimo ${SITUACIONES} situaciones`];
  const tope = TOPES[grado]?.situacion;
  s.forEach((x: Record<string, unknown>, i: number) => {
    const c = `${ctx}.situaciones[${i}]`;
    if (!esTexto(x?.id) || !esTexto(x?.enunciado)) errs.push(`${c}: id y enunciado`);
    if ('correctAnswer' in (x ?? {}) || 'puntaje' in (x ?? {})) errs.push(`${c}: Elige camino no tiene respuesta correcta ni puntaje`);
    largo(errs, `${c}.enunciado`, x?.enunciado, tope);
    for (const k of ['opcionA', 'opcionB'] as const) {
      const o = x?.[k] as Record<string, unknown> | undefined;
      if (!esTexto(o?.texto) || !esTexto(o?.consecuencia)) errs.push(`${c}.${k}: texto y consecuencia`);
      largo(errs, `${c}.${k}.consecuencia`, o?.consecuencia, tope);
    }
  });
  return errs;
}

export function validarMicroteoria(b: Record<string, unknown>, ctx = 'microteoria'): string[] {
  const errs: string[] = [];
  if (!MUNDOS_CONTENIDO.includes(b.worldId as never)) errs.push(`${ctx}: mundo desconocido`);
  if (b.generadoPor !== 'ia' || b.pendiente_validacion_docente !== true) errs.push(`${ctx}: generadoPor 'ia' y pendiente_validacion_docente true`);
  const cards = b.cards;
  if (!Array.isArray(cards) || cards.length < 1) return [...errs, `${ctx}: al menos una tarjeta`];
  const tope = TOPES[String(b.grado)]?.teoria;
  cards.forEach((c: Record<string, unknown>, i: number) => {
    if (!esTexto(c?.titulo) || !esTexto(c?.cuerpo) || !esTexto(c?.ejemplo)) errs.push(`${ctx}.cards[${i}]: titulo, cuerpo y ejemplo`);
    largo(errs, `${ctx}.cards[${i}].cuerpo`, c?.cuerpo, tope);
  });
  return errs;
}

/** Qué archivo es por su nombre: `1_world_2_ordenar.json`, `1_world_2.json` (Elige camino). */
export function validarArchivo(nombre: string, datos: unknown, carpeta: 'bancos' | 'microteoria'): string[] {
  const d = (datos ?? {}) as Record<string, unknown>;
  const base = nombre.replace(/\.json$/, '');
  if (carpeta === 'microteoria') {
    if (base !== `${d.grado}_${d.worldId}`) return [`${nombre}: el nombre debe ser ${d.grado}_${d.worldId}.json`];
    return validarMicroteoria(d, nombre);
  }
  if (TIPOS_CONTENIDO.some((t) => base.endsWith(`_${t}`))) return validarBancoQuiz(d, nombre);
  return validarEligeCamino(d, nombre);
}

/** Lo que tiene que existir: cada grado con banco × mundo × (3 tipos + Elige camino + micro-teoría). */
export function archivosEsperados(): { bancos: string[]; microteoria: string[] } {
  const bancos: string[] = [];
  const microteoria: string[] = [];
  for (const g of SEEDED_GRADOS) {
    for (const w of MUNDOS_CONTENIDO) {
      for (const t of TIPOS_CONTENIDO) bancos.push(`${g}_${w}_${t}.json`);
      bancos.push(`${g}_${w}.json`);
      microteoria.push(`${g}_${w}.json`);
    }
  }
  return { bancos, microteoria };
}
