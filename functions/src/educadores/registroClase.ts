/**
 * Fase 1 — resúmenes del registro de clase. Cada intento que el estudiante
 * escribe en `colegios/{cid}/cursos/{k}/estudiantes/{uid}/intentos/{id}`
 * (src/features/dashboard/data/registroClase.ts) actualiza:
 *
 * - `estudiantes/{uid}/resumen/clase`: sus totales en la clase y por mundo
 *   (intentos, respuestas, aciertos, tiempo, jefes, fechas). En transacción:
 *   es un solo estudiante, casi sin contención.
 *   Desde la Fase 7 también por desempeño del MEN (`porDesempeno`), con el
 *   desempeño que trae cada respuesta: así el panel dice qué porcentaje de un
 *   grado logra cada desempeño.
 * - `cursos/{k}/agregados/preguntas_{worldId}`: por pregunta, cuántas veces se
 *   respondió, cuántas bien, el tiempo y las respuestas erradas más elegidas.
 *   Con incrementos: varios estudiantes escriben a la vez. Sin datos nominales.
 *
 * Los datos del cliente se recortan aquí también (las reglas ya los validan).
 */
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';

export interface RespuestaIntento {
  p: string;
  t: string;
  ok: boolean;
  r: string;
  ms: number;
  /** Desempeño del MEN (Fase 7), si la pregunta lo trae. */
  d?: string;
}

export interface IntentoLeido {
  worldId: string;
  tipo: 'leccion' | 'jefe';
  resultado: 'completado' | 'perdido';
  finAt: number;
  duracionMs: number;
  respuestas: RespuestaIntento[];
}

export interface ResumenMundo {
  intentos: number;
  respuestas: number;
  aciertos: number;
  jefesGanados: number;
  primerIntentoAt: number | null;
  ultimoIntentoAt: number | null;
  conquistadoAt: number | null;
}

export interface ResumenClase {
  intentos: number;
  lecciones: number;
  jefes: number;
  jefesGanados: number;
  respuestas: number;
  aciertos: number;
  duracionMs: number;
  primerIntentoAt: number | null;
  ultimoIntentoAt: number | null;
  porMundo: Record<string, ResumenMundo>;
  /** Fase 7: respuestas y aciertos por desempeño del MEN. */
  porDesempeno: Record<string, { respuestas: number; aciertos: number }>;
}

export const RESUMEN_VACIO: ResumenClase = {
  intentos: 0,
  lecciones: 0,
  jefes: 0,
  jefesGanados: 0,
  respuestas: 0,
  aciertos: 0,
  duracionMs: 0,
  primerIntentoAt: null,
  ultimoIntentoAt: null,
  porMundo: {},
  porDesempeno: {},
};

const ID_DESEMPENO = /^[A-Z]{2}-\d{2,4}-\d$/;

const MAX_RESPUESTAS = 40;
const MAX_DURACION_MS = 2 * 60 * 60 * 1000;
const MAX_MS_RESPUESTA = 10 * 60 * 1000;

const num = (v: unknown, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;

/** Lee y recorta un intento tal como llegó. null si no sirve. */
export function leerIntento(d: Record<string, unknown> | undefined): IntentoLeido | null {
  if (!d || typeof d.worldId !== 'string' || !d.worldId) return null;
  if (d.tipo !== 'leccion' && d.tipo !== 'jefe') return null;
  const respuestas = (Array.isArray(d.respuestas) ? d.respuestas : [])
    .slice(0, MAX_RESPUESTAS)
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .filter((r) => typeof r.p === 'string' && r.p.length > 0)
    .map((r) => ({
      p: String(r.p).slice(0, 120),
      t: typeof r.t === 'string' ? r.t : '',
      ok: r.ok === true,
      r: typeof r.r === 'string' ? r.r.slice(0, 80) : '',
      ms: num(r.ms, MAX_MS_RESPUESTA),
      ...(typeof r.d === 'string' && ID_DESEMPENO.test(r.d) ? { d: r.d } : {}),
    }));
  return {
    worldId: d.worldId.slice(0, 60),
    tipo: d.tipo,
    resultado: d.resultado === 'completado' ? 'completado' : 'perdido',
    finAt: num(d.finAt, Number.MAX_SAFE_INTEGER),
    duracionMs: num(d.duracionMs, MAX_DURACION_MS),
    respuestas,
  };
}

const minimo = (a: number | null, b: number) => (a == null ? b : Math.min(a, b));
const maximo = (a: number | null, b: number) => (a == null ? b : Math.max(a, b));

/** Suma un intento al resumen del estudiante. Puro. */
export function sumarIntento(resumen: ResumenClase, i: IntentoLeido): ResumenClase {
  const aciertos = i.respuestas.filter((r) => r.ok).length;
  const ganoJefe = i.tipo === 'jefe' && i.resultado === 'completado';
  const m = resumen.porMundo[i.worldId] ?? {
    intentos: 0,
    respuestas: 0,
    aciertos: 0,
    jefesGanados: 0,
    primerIntentoAt: null,
    ultimoIntentoAt: null,
    conquistadoAt: null,
  };
  const porDesempeno = { ...(resumen.porDesempeno ?? {}) };
  for (const r of i.respuestas) {
    if (!r.d) continue;
    const a = porDesempeno[r.d] ?? { respuestas: 0, aciertos: 0 };
    porDesempeno[r.d] = { respuestas: a.respuestas + 1, aciertos: a.aciertos + (r.ok ? 1 : 0) };
  }
  return {
    porDesempeno,
    intentos: resumen.intentos + 1,
    lecciones: resumen.lecciones + (i.tipo === 'leccion' ? 1 : 0),
    jefes: resumen.jefes + (i.tipo === 'jefe' ? 1 : 0),
    jefesGanados: resumen.jefesGanados + (ganoJefe ? 1 : 0),
    respuestas: resumen.respuestas + i.respuestas.length,
    aciertos: resumen.aciertos + aciertos,
    duracionMs: resumen.duracionMs + i.duracionMs,
    primerIntentoAt: minimo(resumen.primerIntentoAt, i.finAt),
    ultimoIntentoAt: maximo(resumen.ultimoIntentoAt, i.finAt),
    porMundo: {
      ...resumen.porMundo,
      [i.worldId]: {
        intentos: m.intentos + 1,
        respuestas: m.respuestas + i.respuestas.length,
        aciertos: m.aciertos + aciertos,
        jefesGanados: m.jefesGanados + (ganoJefe ? 1 : 0),
        primerIntentoAt: minimo(m.primerIntentoAt, i.finAt),
        ultimoIntentoAt: maximo(m.ultimoIntentoAt, i.finAt),
        conquistadoAt: ganoJefe ? minimo(m.conquistadoAt, i.finAt) : m.conquistadoAt,
      },
    },
  };
}

/** Respuesta errada como clave de mapa: sin espacios de sobra, corta. */
export function claveRespuesta(r: string): string {
  return r.trim().replace(/\s+/g, ' ').slice(0, 60) || '(vacía)';
}

/**
 * Lo que un intento suma a las estadísticas por pregunta de su mundo, con
 * `inc` = FieldValue.increment (inyectable para probar).
 */
export function sumaPreguntas<T>(
  i: IntentoLeido,
  inc: (n: number) => T
): { worldId: string; porPregunta: Record<string, Record<string, unknown>> } {
  const porPregunta: Record<string, Record<string, unknown>> = {};
  const cuenta = new Map<
    string,
    { vistas: number; aciertos: number; ms: number; tipo: string; errores: Map<string, number> }
  >();
  for (const r of i.respuestas) {
    const c = cuenta.get(r.p) ?? { vistas: 0, aciertos: 0, ms: 0, tipo: r.t, errores: new Map() };
    c.vistas += 1;
    c.ms += r.ms;
    if (r.ok) c.aciertos += 1;
    else {
      const k = claveRespuesta(r.r);
      c.errores.set(k, (c.errores.get(k) ?? 0) + 1);
    }
    cuenta.set(r.p, c);
  }
  for (const [p, c] of cuenta) {
    porPregunta[p] = {
      tipo: c.tipo,
      vistas: inc(c.vistas),
      aciertos: inc(c.aciertos),
      ms: inc(Math.round(c.ms)),
      ...(c.errores.size > 0
        ? { errores: Object.fromEntries([...c.errores].map(([k, n]) => [k, inc(n)])) }
        : {}),
    };
  }
  return { worldId: i.worldId, porPregunta };
}

export async function procesarIntento(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  uid: string,
  data: Record<string, unknown> | undefined
): Promise<void> {
  const intento = leerIntento(data);
  if (!intento) return;
  const base = `colegios/${colegioId}/cursos/${cursoId}`;
  const resumenRef = db.doc(`${base}/estudiantes/${uid}/resumen/clase`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(resumenRef);
    const actual = snap.exists
      ? ({ ...RESUMEN_VACIO, ...snap.data() } as ResumenClase)
      : RESUMEN_VACIO;
    tx.set(resumenRef, sumarIntento(actual, intento));
  });
  if (intento.respuestas.length > 0) {
    // El id del doc no puede llevar "/": un mundo propio nunca lo tiene, pero se limpia igual.
    const idMundo = intento.worldId.replace(/\//g, '_');
    await db
      .doc(`${base}/agregados/preguntas_${idMundo}`)
      .set(
        { ...sumaPreguntas(intento, (n) => FieldValue.increment(n)), actualizadoAt: Date.now() },
        { merge: true }
      );
  }
}

export const onIntentoClase = onDocumentCreated(
  'colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/intentos/{intentoId}',
  async (event) => {
    const { cid, cursoId, uid } = event.params;
    await procesarIntento(getFirestore(), cid, cursoId, uid, event.data?.data());
  }
);
