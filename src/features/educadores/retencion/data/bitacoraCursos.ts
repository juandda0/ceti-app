/**
 * Del tablero de cada clase a la Bitácora del domingo: convierte el reporte del
 * curso y el progreso por mundo en el `CursoBitacora` que espera
 * `construirBitacora` (dominio). Puro: recibe `ahora` y los nombres de mundo.
 */
import { DIA_MS, type CursoBitacora } from '@/functions/src/educadores/dominio';
import type { StudentReportRow } from '@features/dashboard/data/courseReport';
import type { AsignacionAny, WorldProgress } from '@shared/types/tenancy';

export type ProgresoMundo = WorldProgress & { worldId: string };

/**
 * Quices de la semana: cada documento de progreso (estudiante × mundo) que se
 * actualizó en los últimos 7 días cuenta como un quiz. Es un mínimo: el progreso
 * guarda el último intento por mundo, no cada intento.
 */
export function quicesUltimos7Dias(progreso: ProgresoMundo[], ahora: number): number {
  const desde = ahora - 7 * DIA_MS;
  return progreso.filter((p) => p.updatedAt >= desde && p.updatedAt <= ahora).length;
}

/** Mundo con menor maestría promedio entre los que tienen datos. */
export function mundoMasDificil(
  progreso: ProgresoMundo[],
  nombreMundo: (worldId: string) => string
): { worldId: string; nombre: string; maestria: number } | null {
  const porMundo = new Map<string, number[]>();
  for (const p of progreso) {
    const lista = porMundo.get(p.worldId) ?? [];
    lista.push(p.mastery);
    porMundo.set(p.worldId, lista);
  }
  let peor: { worldId: string; nombre: string; maestria: number } | null = null;
  for (const [worldId, valores] of porMundo) {
    const maestria = valores.reduce((a, b) => a + b, 0) / valores.length;
    // Empate: gana el primero en orden de mundo, para que el resultado sea estable.
    if (
      peor === null ||
      maestria < peor.maestria ||
      (maestria === peor.maestria && worldId < peor.worldId)
    ) {
      peor = { worldId, nombre: nombreMundo(worldId), maestria };
    }
  }
  return peor;
}

/** Asignaciones vigentes hoy (ya empezaron y no han vencido). */
export function asignacionesActivas(asignaciones: AsignacionAny[], ahora: number): number {
  return asignaciones.filter((a) => a.fechaInicio <= ahora && ahora <= a.deadline).length;
}

export interface EntradaCursoBitacora {
  cursoId: string;
  nombre: string;
  estudiantes: StudentReportRow[];
  progreso: ProgresoMundo[];
  asignaciones: AsignacionAny[];
  nombreMundo: (worldId: string) => string;
  ahora: number;
}

export function cursoBitacoraDesdeReporte(e: EntradaCursoBitacora): CursoBitacora {
  // Solo cuenta el progreso de quienes siguen en la lista (un suprimido no deja rastro).
  const vigentes = new Set(e.estudiantes.filter((s) => s.estado !== 'suprimido').map((s) => s.uid));
  const progreso = e.progreso.filter((p) => vigentes.has(p.uid));
  const dificil = mundoMasDificil(progreso, e.nombreMundo);
  return {
    cursoId: e.cursoId,
    nombre: e.nombre,
    estudiantes: e.estudiantes
      .filter((s) => s.estado !== 'suprimido')
      .map((s) => ({
        nombre: s.nombre,
        activo: s.estado === 'activo',
        ultimaActividad: s.lastActivity,
        maestria: s.overallMastery,
      })),
    quicesSemana: quicesUltimos7Dias(progreso, e.ahora),
    mundoMasDificil: dificil ? { nombre: dificil.nombre, maestria: dificil.maestria } : null,
    asignacionesActivas: asignacionesActivas(e.asignaciones, e.ahora),
  };
}
