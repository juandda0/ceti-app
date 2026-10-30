/**
 * Fase 9 — tareas abiertas con rúbrica. El profe que edita la clase escribe
 * una consigna y una rúbrica (2 a 6 criterios × 4 niveles con puntos y
 * descriptor); el estudiante responde en texto; cualquier profe de la clase
 * (también quien solo ve y califica) elige un nivel por criterio y deja un
 * comentario. La nota sale de los puntos en la escala del SIEE. La IA solo
 * SUGIERE niveles con una frase de por qué: el profe acepta o cambia. Puro.
 *
 * Datos: `cursos/{k}/tareasAbiertas/{id}` y `…/{id}/entregas/{uid}`.
 */
import { ESCALA_POR_DEFECTO, desempenoDeNota, type Desempeno, type EscalaSiee } from './notas1290';

export const MAX_TITULO_TAREA = 80;
export const MAX_CONSIGNA = 1000;
export const MAX_RESPUESTA = 1500;
export const MAX_COMENTARIO = 500;
export const MIN_CRITERIOS = 2;
export const MAX_CRITERIOS = 6;
export const NIVELES_RUBRICA = 4;
export const MAX_NOMBRE_CRITERIO = 60;
export const MAX_DESCRIPTOR = 200;

export interface NivelRubrica {
  nombre: string;
  puntos: number;
  descriptor: string;
}
export interface CriterioRubrica {
  nombre: string;
  /** De menor a mayor: Bajo, Básico, Alto, Superior. */
  niveles: NivelRubrica[];
}
export interface Rubrica {
  criterios: CriterioRubrica[];
}

export interface TareaAbierta {
  titulo: string;
  consigna: string;
  rubrica: Rubrica;
  /** ms, o null sin fecha. */
  deadline: number | null;
  /** Mundo con el que se relaciona (opcional). */
  worldId: string | null;
  estado: 'abierta' | 'cerrada';
  creadaPor: string;
  creadaAt: number;
}

export interface Calificacion {
  /** Índice del nivel elegido en cada criterio. */
  niveles: number[];
  puntos: number;
  total: number;
  nota: number;
  comentario: string;
  calificadaPor: string;
  calificadaAt: number;
}

export interface Entrega {
  uid: string;
  texto: string;
  entregadaAt: number;
  calificacion?: Calificacion | null;
}

/** Plantilla de cuatro niveles con los nombres del Decreto 1290. */
export const NOMBRES_NIVEL = ['Bajo', 'Básico', 'Alto', 'Superior'] as const;

export function criterioVacio(nombre = ''): CriterioRubrica {
  return { nombre, niveles: NOMBRES_NIVEL.map((n, i) => ({ nombre: n, puntos: i + 1, descriptor: '' })) };
}

/** Rúbrica de arranque para una tarea de finanzas (el profe la cambia). */
export function rubricaInicial(): Rubrica {
  return {
    criterios: [
      { ...criterioVacio('Cuentas claras'), niveles: criterioVacio().niveles.map((n, i) => ({ ...n, descriptor: ['Las cuentas no cuadran.', 'Cuadran con errores.', 'Cuadran y se entienden.', 'Cuadran y explica cada paso.'][i] })) },
      { ...criterioVacio('Explica su decisión'), niveles: criterioVacio().niveles.map((n, i) => ({ ...n, descriptor: ['No explica.', 'Explica sin razones.', 'Da una razón clara.', 'Compara opciones con razones.'][i] })) },
    ],
  };
}

export type ErrorTarea =
  | 'titulo'
  | 'consigna'
  | 'criterios'
  | 'criterio_nombre'
  | 'niveles'
  | 'puntos'
  | 'descriptor'
  | 'fecha';

export const MENSAJES_ERROR_TAREA: Record<ErrorTarea, string> = {
  titulo: `Ponle un título de hasta ${MAX_TITULO_TAREA} caracteres.`,
  consigna: `Escribe la consigna (hasta ${MAX_CONSIGNA} caracteres).`,
  criterios: `La rúbrica lleva de ${MIN_CRITERIOS} a ${MAX_CRITERIOS} criterios.`,
  criterio_nombre: 'Cada criterio necesita un nombre corto.',
  niveles: `Cada criterio lleva ${NIVELES_RUBRICA} niveles.`,
  puntos: 'Los puntos de cada criterio deben subir de un nivel al siguiente.',
  descriptor: `Cada descriptor va hasta ${MAX_DESCRIPTOR} caracteres.`,
  fecha: 'La fecha de entrega ya pasó.',
};

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valida y limpia una tarea nueva o editada (sin los campos del servidor). */
export function leerTarea(
  d: unknown,
  ahora: number
): { ok: true; tarea: Pick<TareaAbierta, 'titulo' | 'consigna' | 'rubrica' | 'deadline' | 'worldId'> } | { ok: false; error: ErrorTarea } {
  const r = (d ?? {}) as Record<string, unknown>;
  const titulo = txt(r.titulo, MAX_TITULO_TAREA + 1);
  if (!titulo || titulo.length > MAX_TITULO_TAREA) return { ok: false, error: 'titulo' };
  const consigna = txt(r.consigna, MAX_CONSIGNA + 1);
  if (!consigna || consigna.length > MAX_CONSIGNA) return { ok: false, error: 'consigna' };
  const criteriosRaw = (r.rubrica as { criterios?: unknown } | undefined)?.criterios;
  if (!Array.isArray(criteriosRaw) || criteriosRaw.length < MIN_CRITERIOS || criteriosRaw.length > MAX_CRITERIOS) {
    return { ok: false, error: 'criterios' };
  }
  const criterios: CriterioRubrica[] = [];
  for (const c of criteriosRaw as Record<string, unknown>[]) {
    const nombre = txt(c?.nombre, MAX_NOMBRE_CRITERIO);
    if (!nombre) return { ok: false, error: 'criterio_nombre' };
    if (!Array.isArray(c.niveles) || c.niveles.length !== NIVELES_RUBRICA) return { ok: false, error: 'niveles' };
    const niveles: NivelRubrica[] = [];
    for (const [i, n] of (c.niveles as Record<string, unknown>[]).entries()) {
      const puntos = Number(n?.puntos);
      if (!Number.isInteger(puntos) || puntos < 0 || puntos > 100) return { ok: false, error: 'puntos' };
      if (i > 0 && puntos <= niveles[i - 1].puntos) return { ok: false, error: 'puntos' };
      if (typeof n?.descriptor === 'string' && n.descriptor.trim().length > MAX_DESCRIPTOR) return { ok: false, error: 'descriptor' };
      niveles.push({ nombre: txt(n?.nombre, 30) || NOMBRES_NIVEL[i], puntos, descriptor: txt(n?.descriptor, MAX_DESCRIPTOR) });
    }
    criterios.push({ nombre, niveles });
  }
  const deadline = typeof r.deadline === 'number' && Number.isFinite(r.deadline) ? r.deadline : null;
  if (deadline !== null && deadline < ahora - 60_000) return { ok: false, error: 'fecha' };
  const worldId = typeof r.worldId === 'string' && r.worldId && r.worldId.length <= 60 ? r.worldId : null;
  return { ok: true, tarea: { titulo, consigna, rubrica: { criterios }, deadline, worldId } };
}

export function puntajeMaximo(r: Rubrica): number {
  return r.criterios.reduce((s, c) => s + Math.max(...c.niveles.map((n) => n.puntos)), 0);
}

/** Nota en la escala del SIEE: el mínimo con 0 puntos y el máximo con todos. */
export function notaDeRubrica(puntos: number, total: number, escala: EscalaSiee = ESCALA_POR_DEFECTO): number {
  if (total <= 0) return escala.notaMin;
  const m = Math.min(1, Math.max(0, puntos / total));
  return Math.round((escala.notaMin + (escala.notaMax - escala.notaMin) * m) * 10) / 10;
}

/** Calificación completa a partir de los niveles elegidos, o null si falta alguno. */
export function calificar(
  r: Rubrica,
  niveles: readonly (number | null)[],
  comentario: string,
  profe: string,
  ahora: number,
  escala: EscalaSiee = ESCALA_POR_DEFECTO
): Calificacion | null {
  if (niveles.length !== r.criterios.length) return null;
  let puntos = 0;
  for (const [i, n] of niveles.entries()) {
    if (n === null || !Number.isInteger(n) || n < 0 || n >= r.criterios[i].niveles.length) return null;
    puntos += r.criterios[i].niveles[n].puntos;
  }
  const total = puntajeMaximo(r);
  return {
    niveles: niveles as number[],
    puntos,
    total,
    nota: notaDeRubrica(puntos, total, escala),
    comentario: comentario.trim().slice(0, MAX_COMENTARIO),
    calificadaPor: profe,
    calificadaAt: ahora,
  };
}

export function desempenoDeCalificacion(c: Pick<Calificacion, 'nota'>, escala: EscalaSiee = ESCALA_POR_DEFECTO): Desempeno {
  return desempenoDeNota(c.nota, escala);
}

export interface ResumenTarea {
  entregas: number;
  calificadas: number;
  sinCalificar: number;
  promedio: number | null;
}

export function resumenTarea(entregas: readonly Pick<Entrega, 'calificacion'>[]): ResumenTarea {
  const notas = entregas.map((e) => e.calificacion?.nota).filter((n): n is number => typeof n === 'number');
  return {
    entregas: entregas.length,
    calificadas: notas.length,
    sinCalificar: entregas.length - notas.length,
    promedio: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null,
  };
}

// ---------------------------------------------------------------------------
// Sugerencia de la IA: un nivel por criterio y una frase de por qué.
// ---------------------------------------------------------------------------

export interface SugerenciaCriterio {
  nivel: number;
  porque: string;
}

export const SYSTEM_PROMPT_RUBRICA = [
  'Eres un asistente de un profesor colombiano de educación financiera.',
  'Recibes una consigna, una rúbrica y la respuesta de un estudiante.',
  'Para cada criterio, en orden, propone el nivel que mejor describe la respuesta (0 = el más bajo, 3 = el más alto) y una frase corta en español que diga por qué, citando lo que el estudiante escribió.',
  'No inventes lo que no está en la respuesta. Si la respuesta está vacía o no tiene que ver, propone el nivel 0.',
  'Nunca incluyas datos personales. Responde SOLO con JSON: {"criterios":[{"nivel":0,"porque":"..."}]}',
].join('\n');

/** Texto para el modelo: consigna, rúbrica y respuesta (sin nombre del estudiante). */
export function textoParaIa(t: Pick<TareaAbierta, 'consigna' | 'rubrica'>, respuesta: string): string {
  const rubrica = t.rubrica.criterios
    .map(
      (c, i) =>
        `CRITERIO ${i + 1}: ${c.nombre}\n` +
        c.niveles.map((n, j) => `  nivel ${j} (${n.nombre}): ${n.descriptor || '—'}`).join('\n')
    )
    .join('\n');
  return `CONSIGNA: ${t.consigna}\n\nRÚBRICA:\n${rubrica}\n\nRESPUESTA DEL ESTUDIANTE:\n${respuesta.slice(0, MAX_RESPUESTA)}`;
}

/** Lee la respuesta del modelo; null si no sirve. */
export function leerSugerencia(raw: unknown, criterios: number): SugerenciaCriterio[] | null {
  const lista = (raw as { criterios?: unknown } | null)?.criterios;
  if (!Array.isArray(lista) || lista.length !== criterios) return null;
  const out: SugerenciaCriterio[] = [];
  for (const c of lista as Record<string, unknown>[]) {
    const nivel = Number(c?.nivel);
    if (!Number.isInteger(nivel) || nivel < 0 || nivel >= NIVELES_RUBRICA) return null;
    out.push({ nivel, porque: txt(c?.porque, 240) });
  }
  return out;
}
