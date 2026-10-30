/**
 * Ficha del estudiante (Fase 2): todo lo que el profe necesita saber de un
 * estudiante en su clase, calculado del registro de clase (intentos, visitas,
 * resumen de racha/XP) y del avance por mundo. Puro: la carga está en
 * `cargarFichaEstudiante.ts` y la pantalla en `FichaEstudianteScreen`.
 *
 * Todo sale de lo que el estudiante hizo en el espacio de esta clase, desde que
 * se unió; nunca de su galaxia propia.
 */
import {
  desempenoDeNota,
  notaDesdeMaestria,
  type Desempeno,
  type EscalaSiee,
} from '@/functions/src/educadores/dominio';
import type { IntentoGuardado, VisitaDia } from '@features/dashboard/data/registroClaseRepository';
import type { ResumenOrbitaClase } from '@features/dashboard/data/registroClase';
import type { WorldProgress } from '@shared/types/tenancy';

const DIA_MS = 24 * 60 * 60 * 1000;
export const SEMANAS_HISTORIAL = 8;
export const MAX_PREGUNTAS_QUE_FALLA = 5;

export interface MundoDeLaClase {
  id: string;
  nombre: string;
  /** Competencia CONPES del mundo, o 'personalizada'. */
  competencia: string;
}

/** Texto de una pregunta para mostrarla, y cómo leer lo que respondió. */
export interface TextoPregunta {
  enunciado: string;
  tipo: string;
  /** Opción múltiple: las opciones (la respuesta guardada es el índice). */
  opciones?: string[];
  /** Ordenar: los elementos (la respuesta guardada son índices "2-0-1"). */
  elementos?: string[];
}

export interface EntradaFicha {
  ahora: number;
  intentos: IntentoGuardado[];
  visitas: VisitaDia[];
  progreso: (Pick<WorldProgress, 'mastery' | 'completed' | 'competencia'> & {
    worldId: string;
    completedAt?: number;
  })[];
  orbita: ResumenOrbitaClase | null;
  mundos: MundoDeLaClase[];
  textos: Map<string, TextoPregunta>;
  /** Acierto de toda la clase (0..1) en las mismas preguntas, si se conoce. */
  aciertoClase: number | null;
  /** Escala SIEE de la entidad (Fase 6); sin ella, 1,0–5,0. */
  escala?: EscalaSiee;
}

export interface CompetenciaFicha {
  id: string;
  respuestas: number;
  /** 0..1 */
  acierto: number;
}

export interface PreguntaQueFalla {
  id: string;
  worldId: string;
  mundo: string;
  enunciado: string;
  vistas: number;
  aciertos: number;
  /** La última respuesta equivocada, ya en texto. */
  ultimaErrada: string | null;
}

export interface SemanaFicha {
  /** Lunes 00:00 de la semana (hora local). */
  inicio: number;
  respuestas: number;
  /** 0..1, o null sin respuestas esa semana. */
  acierto: number | null;
  minutos: number;
}

export type EstadoMundo = 'sin_empezar' | 'en_curso' | 'conquistado';

export interface MundoFicha {
  id: string;
  nombre: string;
  estado: EstadoMundo;
  primerIntentoAt: number | null;
  ultimoIntentoAt: number | null;
  conquistadoAt: number | null;
  lecciones: number;
  jefesIntentados: number;
  jefesGanados: number;
  respuestas: number;
  /** 0..1, o null sin respuestas. */
  acierto: number | null;
  /** Maestría del jefe (0..1), si ya lo ganó. */
  maestria: number | null;
}

export interface Ficha {
  /** Nota del periodo (escala SIEE de la entidad o la de por defecto) con la maestría de los mundos ganados. */
  nota: number | null;
  desempeno: Desempeno | null;
  /** Aciertos sobre todas sus respuestas en la clase (0..1). */
  acierto: number | null;
  respuestas: number;
  intentos: number;
  minutosTotal: number;
  minutosSemana: number;
  /** Días distintos con actividad en los últimos 7. */
  diasActivosSemana: number;
  visitasSemana: number;
  visitasTotal: number;
  ultimaActividad: number | null;
  porCompetencia: CompetenciaFicha[];
  fuertes: string[];
  debiles: string[];
  preguntasQueFalla: PreguntaQueFalla[];
  semanas: SemanaFicha[];
  mundos: MundoFicha[];
  orbita: ResumenOrbitaClase | null;
  comparacion: { estudiante: number | null; clase: number | null };
}

/** Lunes 00:00 local de la semana de `t`. */
export function inicioDeSemana(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  return d.getTime();
}

function diaLocal(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const proporcion = (a: number, n: number): number | null => (n > 0 ? a / n : null);
const minutos = (ms: number) => Math.round(ms / 60000);

/** Lo que respondió, en palabras: la opción, verdadero/falso o el orden elegido. */
export function respuestaEnTexto(r: string, texto: TextoPregunta | undefined): string {
  if (!texto) return r;
  if ((texto.tipo === 'multiple_choice' || texto.tipo === 'completar') && texto.opciones) {
    const i = Number(r);
    return Number.isInteger(i) && texto.opciones[i] != null ? texto.opciones[i] : r;
  }
  if (texto.tipo === 'true_false') return r === 'true' ? 'Verdadero' : r === 'false' ? 'Falso' : r;
  if (texto.tipo === 'emparejar' && texto.elementos) {
    // Para cada concepto, la pareja que eligió (los elementos van como "izq → der").
    const elegidas = r.split('-').map(Number);
    const pares = texto.elementos.map((e) => e.split(' → '));
    if (elegidas.length === pares.length && elegidas.every((j) => pares[j] != null)) {
      return pares.map((p, i) => `${p[0]} → ${pares[elegidas[i]][1]}`).join('; ');
    }
  }
  if (texto.tipo === 'ordenar' && texto.elementos) {
    const orden = r.split('-').map(Number);
    if (orden.every((i) => Number.isInteger(i) && texto.elementos?.[i] != null)) {
      return orden.map((i) => texto.elementos?.[i]).join(' → ');
    }
  }
  return r;
}

export function construirFicha(e: EntradaFicha): Ficha {
  const competenciaDe = new Map(e.mundos.map((m) => [m.id, m.competencia]));
  const nombreDe = new Map(e.mundos.map((m) => [m.id, m.nombre]));
  const semanaActual = inicioDeSemana(e.ahora);
  const hace7 = e.ahora - 7 * DIA_MS;

  let respuestas = 0;
  let aciertos = 0;
  let duracion = 0;
  let duracionSemana = 0;
  let ultima: number | null = null;
  const dias = new Set<string>();
  const comp = new Map<string, { n: number; ok: number }>();
  const preguntas = new Map<
    string,
    { worldId: string; vistas: number; ok: number; ultimaErrada: string | null; ultimaAt: number }
  >();
  const semanas = new Map<number, { n: number; ok: number; ms: number }>();
  const porMundo = new Map<
    string,
    {
      primer: number | null;
      ultimo: number | null;
      lecciones: number;
      jefes: number;
      ganados: number;
      conquistado: number | null;
      n: number;
      ok: number;
    }
  >();

  for (const i of e.intentos) {
    const n = i.respuestas.length;
    const ok = i.respuestas.filter((r) => r.ok).length;
    respuestas += n;
    aciertos += ok;
    duracion += i.duracionMs;
    if (i.finAt >= hace7) {
      duracionSemana += i.duracionMs;
      dias.add(diaLocal(i.finAt));
    }
    ultima = ultima == null ? i.finAt : Math.max(ultima, i.finAt);

    const c = competenciaDe.get(i.worldId) ?? 'personalizada';
    const cc = comp.get(c) ?? { n: 0, ok: 0 };
    comp.set(c, { n: cc.n + n, ok: cc.ok + ok });

    const s = inicioDeSemana(i.finAt);
    const ss = semanas.get(s) ?? { n: 0, ok: 0, ms: 0 };
    semanas.set(s, { n: ss.n + n, ok: ss.ok + ok, ms: ss.ms + i.duracionMs });

    const m = porMundo.get(i.worldId) ?? {
      primer: null,
      ultimo: null,
      lecciones: 0,
      jefes: 0,
      ganados: 0,
      conquistado: null,
      n: 0,
      ok: 0,
    };
    const ganoJefe = i.tipo === 'jefe' && i.resultado === 'completado';
    porMundo.set(i.worldId, {
      primer: m.primer == null ? i.finAt : Math.min(m.primer, i.finAt),
      ultimo: m.ultimo == null ? i.finAt : Math.max(m.ultimo, i.finAt),
      lecciones: m.lecciones + (i.tipo === 'leccion' ? 1 : 0),
      jefes: m.jefes + (i.tipo === 'jefe' ? 1 : 0),
      ganados: m.ganados + (ganoJefe ? 1 : 0),
      conquistado: ganoJefe
        ? m.conquistado == null
          ? i.finAt
          : Math.min(m.conquistado, i.finAt)
        : m.conquistado,
      n: m.n + n,
      ok: m.ok + ok,
    });

    for (const r of i.respuestas) {
      const p = preguntas.get(r.p) ?? {
        worldId: i.worldId,
        vistas: 0,
        ok: 0,
        ultimaErrada: null,
        ultimaAt: 0,
      };
      p.vistas += 1;
      if (r.ok) p.ok += 1;
      else if (i.finAt >= p.ultimaAt) {
        p.ultimaErrada = r.r;
        p.ultimaAt = i.finAt;
      }
      preguntas.set(r.p, p);
    }
  }

  let visitasSemana = 0;
  let visitasTotal = 0;
  for (const v of e.visitas) {
    visitasTotal += v.visitas;
    if (v.ultimaAt >= hace7) {
      visitasSemana += v.visitas;
      dias.add(diaLocal(v.ultimaAt));
    }
    ultima = ultima == null ? v.ultimaAt : Math.max(ultima, v.ultimaAt);
  }

  // Nota: la misma regla que Notas del periodo (maestría de los mundos ganados).
  const maestrias = e.progreso.filter((p) => p.completed).map((p) => p.mastery);
  const maestria = maestrias.length
    ? maestrias.reduce((a, b) => a + b, 0) / maestrias.length
    : null;
  const nota = maestria == null ? null : notaDesdeMaestria(maestria, e.escala);

  const porCompetencia = [...comp.entries()]
    .filter(([, v]) => v.n > 0)
    .map(([id, v]) => ({ id, respuestas: v.n, acierto: v.ok / v.n }))
    .sort((a, b) => b.acierto - a.acierto);
  // Con pocas respuestas no se juzga: hacen falta al menos 5 en la competencia.
  const juzgables = porCompetencia.filter((c) => c.respuestas >= 5);

  const preguntasQueFalla = [...preguntas.entries()]
    .filter(([, p]) => p.vistas > p.ok)
    .sort(([, a], [, b]) => a.ok / a.vistas - b.ok / b.vistas || b.vistas - a.vistas)
    .slice(0, MAX_PREGUNTAS_QUE_FALLA)
    .map(([id, p]) => {
      const texto = e.textos.get(id);
      return {
        id,
        worldId: p.worldId,
        mundo: nombreDe.get(p.worldId) ?? p.worldId,
        enunciado: texto?.enunciado ?? id,
        vistas: p.vistas,
        aciertos: p.ok,
        ultimaErrada: p.ultimaErrada == null ? null : respuestaEnTexto(p.ultimaErrada, texto),
      };
    });

  const historial: SemanaFicha[] = [];
  for (let k = SEMANAS_HISTORIAL - 1; k >= 0; k--) {
    const d = new Date(semanaActual);
    d.setDate(d.getDate() - 7 * k);
    const inicio = d.getTime();
    const s = semanas.get(inicio);
    historial.push({
      inicio,
      respuestas: s?.n ?? 0,
      acierto: s ? proporcion(s.ok, s.n) : null,
      minutos: s ? minutos(s.ms) : 0,
    });
  }

  const progresoDe = new Map(e.progreso.map((p) => [p.worldId, p]));
  const mundos: MundoFicha[] = e.mundos.map((mundo) => {
    const m = porMundo.get(mundo.id);
    const p = progresoDe.get(mundo.id);
    const conquistadoAt = m?.conquistado ?? (p?.completed ? (p.completedAt ?? null) : null);
    return {
      id: mundo.id,
      nombre: mundo.nombre,
      estado: p?.completed || m?.conquistado ? 'conquistado' : m ? 'en_curso' : 'sin_empezar',
      primerIntentoAt: m?.primer ?? null,
      ultimoIntentoAt: m?.ultimo ?? null,
      conquistadoAt,
      lecciones: m?.lecciones ?? 0,
      jefesIntentados: m?.jefes ?? 0,
      jefesGanados: m?.ganados ?? 0,
      respuestas: m?.n ?? 0,
      acierto: m ? proporcion(m.ok, m.n) : null,
      maestria: p?.completed ? p.mastery : null,
    };
  });

  const acierto = proporcion(aciertos, respuestas);
  return {
    nota,
    desempeno: nota == null ? null : desempenoDeNota(nota, e.escala),
    acierto,
    respuestas,
    intentos: e.intentos.length,
    minutosTotal: minutos(duracion),
    minutosSemana: minutos(duracionSemana),
    diasActivosSemana: dias.size,
    visitasSemana,
    visitasTotal,
    ultimaActividad: ultima,
    porCompetencia,
    fuertes: juzgables.filter((c) => c.acierto >= 0.8).map((c) => c.id),
    debiles: juzgables.filter((c) => c.acierto < 0.6).map((c) => c.id),
    preguntasQueFalla,
    semanas: historial,
    mundos,
    orbita: e.orbita,
    comparacion: { estudiante: acierto, clase: e.aciertoClase },
  };
}
