/**
 * Fase 9 — requisitos para abrir un mundo de la clase. Viven en la entrada del
 * mundo en `config/mundos` (`requisitos`) y se combinan: una fecha desde la
 * que se abre, otro mundo que hay que conquistar antes y una nota mínima en
 * ese mundo (escala del SIEE). Se suman a la cadena de siempre (cada mundo
 * pide los anteriores) y nunca vuelven a cerrar un mundo ya conquistado. Es
 * una guía pedagógica que aplica la app del estudiante, no una regla de
 * seguridad. En Mi galaxia no hay requisitos. Puro.
 */
import { DIA_MS, fechaBogota, inicioDiaBogota } from './calendario';
import { ESCALA_POR_DEFECTO, notaDesdeMaestria, type EscalaSiee } from './notas1290';

export interface RequisitosMundo {
  /** 'YYYY-MM-DD' (hora de Bogotá): el mundo se abre ese día a las 00:00. */
  desde?: string | null;
  /** worldId que hay que conquistar antes. */
  despuesDe?: string | null;
  /** Nota mínima (escala del SIEE) en `despuesDe`. Sin `despuesDe` no aplica. */
  notaMinima?: number | null;
}

export type FaltaRequisito =
  | { tipo: 'fecha'; desde: string }
  | { tipo: 'mundo'; worldId: string }
  | { tipo: 'nota'; worldId: string; minima: number; actual: number | null };

export interface ContextoRequisitos {
  ahora: number;
  /** Mundos visibles de la clase (un requisito sobre otro mundo se ignora). */
  visibles: ReadonlySet<string>;
  conquistado: (worldId: string) => boolean;
  /** Maestría 0..1 del mundo, o null sin datos. */
  maestria: (worldId: string) => number | null;
  escala?: EscalaSiee;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Requisitos limpios de una entrada de config, o null si no hay ninguno. */
export function leerRequisitos(raw: unknown, escala: EscalaSiee = ESCALA_POR_DEFECTO): RequisitosMundo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const desde = typeof r.desde === 'string' && FECHA.test(r.desde) && !Number.isNaN(Date.parse(r.desde)) ? r.desde : null;
  const despuesDe = typeof r.despuesDe === 'string' && r.despuesDe.trim() && r.despuesDe.length <= 60 ? r.despuesDe : null;
  const n = typeof r.notaMinima === 'number' && Number.isFinite(r.notaMinima) ? Math.round(r.notaMinima * 10) / 10 : null;
  const notaMinima = despuesDe && n !== null && n > escala.notaMin && n <= escala.notaMax ? n : null;
  if (!desde && !despuesDe) return null;
  return { desde, despuesDe, notaMinima };
}

/** Lo que le falta al estudiante para abrir el mundo (vacío = cumple). */
export function faltantesRequisitos(
  req: RequisitosMundo | null | undefined,
  ctx: ContextoRequisitos
): FaltaRequisito[] {
  if (!req) return [];
  const faltan: FaltaRequisito[] = [];
  if (req.desde && ctx.ahora < inicioDiaBogota(req.desde)) faltan.push({ tipo: 'fecha', desde: req.desde });
  const previo = req.despuesDe && ctx.visibles.has(req.despuesDe) ? req.despuesDe : null;
  if (previo) {
    if (!ctx.conquistado(previo)) faltan.push({ tipo: 'mundo', worldId: previo });
    if (req.notaMinima != null) {
      const m = ctx.maestria(previo);
      const actual = m === null ? null : notaDesdeMaestria(m, ctx.escala ?? ESCALA_POR_DEFECTO);
      if (actual === null || actual + 1e-9 < req.notaMinima) {
        faltan.push({ tipo: 'nota', worldId: previo, minima: req.notaMinima, actual });
      }
    }
  }
  return faltan;
}

/** Día en que la fecha deja de faltar (para el calendario), o null. */
export function aperturaPorFecha(req: RequisitosMundo | null | undefined): number | null {
  return req?.desde ? inicioDiaBogota(req.desde) : null;
}

/** 'YYYY-MM-DD' de hoy + n días (Bogotá), para proponer una fecha en el editor. */
export function fechaEnDias(ahora: number, dias: number): string {
  return fechaBogota(ahora + dias * DIA_MS);
}
