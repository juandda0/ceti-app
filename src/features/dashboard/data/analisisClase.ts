/**
 * Análisis de la clase (Fase 3): lo que el profe mira de toda la clase a la vez.
 * Puro; la carga está en `cargarAnalisisClase.ts`.
 *
 * - Mapa de calor: estudiantes × mundos (estado y % de aciertos del periodo).
 * - Preguntas: facilidad (% de aciertos), discriminación (si la aciertan más
 *   los que van bien en general que los que van mal) y la respuesta errada que
 *   más se repite. Una pregunta con discriminación baja o negativa suele estar
 *   mal hecha o ser ambigua.
 * - Actividad: semana a semana, cuántos entraron, y quién lleva 7 días sin entrar.
 * - Tareas: a tiempo, tarde y sin hacer, con nombres.
 * - Grupos ("Los que…"): sin entrar, nota bajo 3,0, sin hacer una tarea.
 *
 * Todo viene del espacio de la clase (Fase 1), nunca de la galaxia propia.
 */
import { notaDesdeMaestria } from '@/functions/src/educadores/dominio';
import {
  inicioDeSemana,
  respuestaEnTexto,
  type EstadoMundo,
  type MundoDeLaClase,
  type TextoPregunta,
} from '@features/dashboard/data/fichaEstudiante';
import type { IntentoGuardado, VisitaDia } from '@features/dashboard/data/registroClaseRepository';
import type { AsignacionWithId } from '@features/dashboard/data/asignacionRepository';

const DIA_MS = 24 * 60 * 60 * 1000;
export const SEMANAS_ACTIVIDAD = 8;
/** Facilidad bajo la cual una pregunta es "difícil" (criterio de Kahoot: ≤ 35 %). */
export const UMBRAL_DIFICIL = 0.35;
/** Discriminación bajo la cual conviene revisar la pregunta. */
export const UMBRAL_DISCRIMINACION = 0.2;
/** Estudiantes que deben haber respondido una pregunta para juzgar su discriminación. */
export const MIN_ESTUDIANTES_DISCRIMINACION = 6;
/** Respuestas mínimas en el periodo para entrar al ranking de la discriminación. */
export const MIN_RESPUESTAS_RANKING = 5;
export const NOTA_MINIMA_APROBAR = 3;

export interface EstudianteDeLaClase {
  uid: string;
  nombre: string;
  intentos: IntentoGuardado[];
  visitas: VisitaDia[];
  progreso: {
    worldId: string;
    mastery: number;
    completed: boolean;
    completedAt?: number;
    /** Última vez que cambió el avance (cuenta como actividad si no hay registro). */
    updatedAt?: number;
  }[];
}

export interface EntradaAnalisis {
  ahora: number;
  /** Periodo que se mira (ms, inclusive). */
  desde: number;
  hasta: number;
  estudiantes: EstudianteDeLaClase[];
  mundos: MundoDeLaClase[];
  textos: Map<string, TextoPregunta>;
  tareas: AsignacionWithId[];
}

export interface CeldaMapa {
  estado: EstadoMundo;
  /** % de aciertos del periodo en ese mundo (0..1), o null si no respondió. */
  acierto: number | null;
}

export interface FilaMapa {
  uid: string;
  nombre: string;
  celdas: Record<string, CeldaMapa>;
  nota: number | null;
  acierto: number | null;
  respuestas: number;
  ultimaActividad: number | null;
}

export interface AnalisisPregunta {
  id: string;
  worldId: string;
  mundo: string;
  enunciado: string;
  respuestas: number;
  estudiantes: number;
  /** % de respuestas correctas (0..1). */
  facilidad: number;
  /** -1..1, o null si no hay datos para juzgarla. */
  discriminacion: number | null;
  erradaMasElegida: { texto: string; veces: number } | null;
  dificil: boolean;
  revisar: boolean;
}

export interface SemanaClase {
  inicio: number;
  /** Estudiantes con al menos un intento o una visita esa semana. */
  activos: number;
  respuestas: number;
  minutos: number;
}

export interface EmbudoTarea {
  id: string;
  worldId: string;
  mundo: string;
  deadline: number;
  vencida: boolean;
  aTiempo: { uid: string; nombre: string }[];
  tarde: { uid: string; nombre: string }[];
  sinHacer: { uid: string; nombre: string }[];
}

export interface AnalisisClase {
  mapa: FilaMapa[];
  preguntas: AnalisisPregunta[];
  semanas: SemanaClase[];
  activosSemana: number;
  sinEntrar7: { uid: string; nombre: string; ultimaActividad: number | null }[];
  tareas: EmbudoTarea[];
  grupos: {
    sinEntrar7: string[];
    bajoTres: string[];
  };
}

const proporcion = (a: number, n: number): number | null => (n > 0 ? a / n : null);

function enPeriodo(t: number, e: EntradaAnalisis) {
  return t >= e.desde && t <= e.hasta;
}

/** Cuándo conquistó el mundo: el progreso o el primer jefe ganado (lo que sea antes). */
function conquistaDe(est: EstudianteDeLaClase, worldId: string): number | null | undefined {
  const p = est.progreso.find((x) => x.worldId === worldId && x.completed);
  const jefes = est.intentos
    .filter((i) => i.worldId === worldId && i.tipo === 'jefe' && i.resultado === 'completado')
    .map((i) => i.finAt);
  const candidatos = [...jefes, ...(typeof p?.completedAt === 'number' ? [p.completedAt] : [])];
  if (candidatos.length > 0) return Math.min(...candidatos);
  // Conquistado sin fecha conocida (datos de antes): cuenta como hecho, sin fecha.
  return p ? null : undefined;
}

export function construirAnalisis(e: EntradaAnalisis): AnalisisClase {
  const nombreMundo = new Map(e.mundos.map((m) => [m.id, m.nombre]));
  const hace7 = e.ahora - 7 * DIA_MS;

  // ── Mapa y totales por estudiante ──────────────────────────────────────
  const aciertoGeneral = new Map<string, { n: number; ok: number }>();
  const mapa: FilaMapa[] = e.estudiantes.map((est) => {
    const delPeriodo = est.intentos.filter((i) => enPeriodo(i.finAt, e));
    const porMundo = new Map<string, { n: number; ok: number }>();
    let n = 0;
    let ok = 0;
    for (const i of delPeriodo) {
      const m = porMundo.get(i.worldId) ?? { n: 0, ok: 0 };
      for (const r of i.respuestas) {
        m.n += 1;
        n += 1;
        if (r.ok) {
          m.ok += 1;
          ok += 1;
        }
      }
      porMundo.set(i.worldId, m);
    }
    aciertoGeneral.set(est.uid, { n, ok });
    const celdas: Record<string, CeldaMapa> = {};
    for (const mundo of e.mundos) {
      const conquista = conquistaDe(est, mundo.id);
      const jugo = est.intentos.some((i) => i.worldId === mundo.id);
      const m = porMundo.get(mundo.id);
      celdas[mundo.id] = {
        estado: conquista !== undefined ? 'conquistado' : jugo ? 'en_curso' : 'sin_empezar',
        acierto: m ? proporcion(m.ok, m.n) : null,
      };
    }
    const maestrias = est.progreso.filter((p) => p.completed).map((p) => p.mastery);
    const nota = maestrias.length
      ? notaDesdeMaestria(maestrias.reduce((a, b) => a + b, 0) / maestrias.length)
      : null;
    const fechas = [
      ...est.intentos.map((i) => i.finAt),
      ...est.visitas.map((v) => v.ultimaAt),
      ...est.progreso.flatMap((p) => (typeof p.updatedAt === 'number' ? [p.updatedAt] : [])),
    ];
    return {
      uid: est.uid,
      nombre: est.nombre,
      celdas,
      nota,
      acierto: proporcion(ok, n),
      respuestas: n,
      ultimaActividad: fechas.length ? Math.max(...fechas) : null,
    };
  });

  // ── Preguntas ──────────────────────────────────────────────────────────
  // Ranking por aciertos del periodo, para los grupos de arriba y de abajo (27 %).
  const ranking = [...aciertoGeneral.entries()]
    .filter(([, v]) => v.n >= MIN_RESPUESTAS_RANKING)
    .sort(([, a], [, b]) => b.ok / b.n - a.ok / a.n)
    .map(([uid]) => uid);
  const tamGrupo = Math.max(2, Math.ceil(ranking.length * 0.27));
  const arriba = new Set(ranking.length >= 4 ? ranking.slice(0, tamGrupo) : []);
  const abajo = new Set(ranking.length >= 4 ? ranking.slice(-tamGrupo) : []);

  const porPregunta = new Map<
    string,
    {
      worldId: string;
      n: number;
      ok: number;
      porEstudiante: Map<string, { n: number; ok: number }>;
      erradas: Map<string, number>;
    }
  >();
  for (const est of e.estudiantes) {
    for (const i of est.intentos) {
      if (!enPeriodo(i.finAt, e)) continue;
      for (const r of i.respuestas) {
        const q = porPregunta.get(r.p) ?? {
          worldId: i.worldId,
          n: 0,
          ok: 0,
          porEstudiante: new Map(),
          erradas: new Map(),
        };
        q.n += 1;
        if (r.ok) q.ok += 1;
        else q.erradas.set(r.r, (q.erradas.get(r.r) ?? 0) + 1);
        const pe = q.porEstudiante.get(est.uid) ?? { n: 0, ok: 0 };
        pe.n += 1;
        if (r.ok) pe.ok += 1;
        q.porEstudiante.set(est.uid, pe);
        porPregunta.set(r.p, q);
      }
    }
  }
  const promedioGrupo = (
    q: { porEstudiante: Map<string, { n: number; ok: number }> },
    grupo: Set<string>
  ): number | null => {
    const vals = [...q.porEstudiante.entries()]
      .filter(([uid]) => grupo.has(uid))
      .map(([, v]) => v.ok / v.n);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const preguntas: AnalisisPregunta[] = [...porPregunta.entries()]
    .map(([id, q]) => {
      const facilidad = q.ok / q.n;
      const pa = promedioGrupo(q, arriba);
      const pb = promedioGrupo(q, abajo);
      const discriminacion =
        q.porEstudiante.size >= MIN_ESTUDIANTES_DISCRIMINACION && pa != null && pb != null
          ? pa - pb
          : null;
      const [errada] = [...q.erradas.entries()].sort((a, b) => b[1] - a[1]);
      const texto = e.textos.get(id);
      return {
        id,
        worldId: q.worldId,
        mundo: nombreMundo.get(q.worldId) ?? q.worldId,
        enunciado: texto?.enunciado ?? id,
        respuestas: q.n,
        estudiantes: q.porEstudiante.size,
        facilidad,
        discriminacion,
        erradaMasElegida: errada
          ? { texto: respuestaEnTexto(errada[0], texto), veces: errada[1] }
          : null,
        dificil: facilidad <= UMBRAL_DIFICIL,
        revisar: discriminacion != null && discriminacion < UMBRAL_DISCRIMINACION,
      };
    })
    .sort((a, b) => a.facilidad - b.facilidad || b.respuestas - a.respuestas);

  // ── Actividad semana a semana ──────────────────────────────────────────
  const semanaActual = inicioDeSemana(e.ahora);
  const semanas: SemanaClase[] = [];
  for (let k = SEMANAS_ACTIVIDAD - 1; k >= 0; k--) {
    const d = new Date(semanaActual);
    d.setDate(d.getDate() - 7 * k);
    const inicio = d.getTime();
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 7);
    const dentro = (t: number) => t >= inicio && t < fin.getTime();
    let activos = 0;
    let respuestas = 0;
    let ms = 0;
    for (const est of e.estudiantes) {
      const intentos = est.intentos.filter((i) => dentro(i.finAt));
      if (intentos.length > 0 || est.visitas.some((v) => dentro(v.ultimaAt))) activos += 1;
      for (const i of intentos) {
        respuestas += i.respuestas.length;
        ms += i.duracionMs;
      }
    }
    semanas.push({ inicio, activos, respuestas, minutos: Math.round(ms / 60000) });
  }
  const sinEntrar7 = mapa
    .filter((f) => f.ultimaActividad == null || f.ultimaActividad < hace7)
    .map((f) => ({ uid: f.uid, nombre: f.nombre, ultimaActividad: f.ultimaActividad }))
    .sort((a, b) => (a.ultimaActividad ?? 0) - (b.ultimaActividad ?? 0));

  // ── Tareas ─────────────────────────────────────────────────────────────
  const tareas: EmbudoTarea[] = e.tareas
    .filter((t): t is AsignacionWithId & { worldId: string } => t.kind !== 'reto')
    .map((t) => {
      const { target } = t;
      const deben = e.estudiantes.filter((est) =>
        target.tipo === 'estudiante' ? est.uid === target.uid : true
      );
      const aTiempo: EmbudoTarea['aTiempo'] = [];
      const tarde: EmbudoTarea['tarde'] = [];
      const sinHacer: EmbudoTarea['sinHacer'] = [];
      for (const est of deben) {
        const c = conquistaDe(est, t.worldId);
        const quien = { uid: est.uid, nombre: est.nombre };
        if (c === undefined) sinHacer.push(quien);
        else if (c == null || c <= t.deadline) aTiempo.push(quien);
        else tarde.push(quien);
      }
      return {
        id: t.id,
        worldId: t.worldId,
        mundo: nombreMundo.get(t.worldId) ?? t.worldId,
        deadline: t.deadline,
        vencida: e.ahora > t.deadline,
        aTiempo,
        tarde,
        sinHacer,
      };
    })
    .sort((a, b) => b.deadline - a.deadline);

  const activosSemana = semanas[semanas.length - 1]?.activos ?? 0;
  return {
    mapa,
    preguntas,
    semanas,
    activosSemana,
    sinEntrar7,
    tareas,
    grupos: {
      sinEntrar7: sinEntrar7.map((s) => s.uid),
      bajoTres: mapa
        .filter((f) => f.nota != null && f.nota < NOTA_MINIMA_APROBAR)
        .map((f) => f.uid),
    },
  };
}
