/**
 * Del reporte del curso a las entradas de `construirNotas` (Decreto 1290): por
 * estudiante, la maestría por competencia con la evidencia del periodo y los
 * mundos completados en él. Puro.
 */
import {
  inicioDiaBogota,
  DIA_MS,
  type EntradaNota,
  type Periodo,
} from '@/functions/src/educadores/dominio';
import { ALL_COMPETENCIAS } from '@features/learning/data/competencias';
import type { StudentReportRow } from '@features/dashboard/data/courseReport';
import type { ProgresoMundo } from './bitacoraCursos';

const COMPETENCIAS_CONPES = new Set(ALL_COMPETENCIAS.map((c) => c.id));

/** Rango [desde, hasta] del periodo en ms, de las 00:00 del primer día al fin del último (Bogotá). */
export function rangoPeriodo(periodo: Periodo): { desde: number; hasta: number } {
  return {
    desde: inicioDiaBogota(periodo.desde),
    hasta: inicioDiaBogota(periodo.hasta) + DIA_MS - 1,
  };
}

/**
 * Una entrada por estudiante de la lista (sin los suprimidos), en orden
 * alfabético como en las planillas. Solo cuenta el progreso actualizado dentro
 * del periodo; un mundo propio sin competencia CONPES ('personalizada') no entra
 * en la nota, pero sí en los mundos completados.
 */
export function entradasNotaDesdeReporte(
  estudiantes: StudentReportRow[],
  progreso: ProgresoMundo[],
  periodo: Periodo
): EntradaNota[] {
  const { desde, hasta } = rangoPeriodo(periodo);
  const enPeriodo = (ms: number | undefined) => ms !== undefined && ms >= desde && ms <= hasta;

  const porEstudiante = new Map<string, ProgresoMundo[]>();
  for (const p of progreso) {
    if (!enPeriodo(p.updatedAt)) continue;
    const lista = porEstudiante.get(p.uid) ?? [];
    lista.push(p);
    porEstudiante.set(p.uid, lista);
  }

  return estudiantes
    .filter((s) => s.estado !== 'suprimido')
    .map((s) => {
      const suyos = porEstudiante.get(s.uid) ?? [];
      const valores: Record<string, number[]> = {};
      for (const p of suyos) {
        if (!COMPETENCIAS_CONPES.has(p.competencia)) continue;
        (valores[p.competencia] ??= []).push(p.mastery);
      }
      const maestriaPorCompetencia = Object.fromEntries(
        Object.entries(valores).map(([id, v]) => [id, v.reduce((a, b) => a + b, 0) / v.length])
      );
      const mundosCompletados = suyos.filter(
        (p) => p.completed && enPeriodo(p.completedAt ?? p.updatedAt)
      ).length;
      return { nombre: s.nombre, maestriaPorCompetencia, mundosCompletados };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
