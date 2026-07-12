/**
 * Loads a course's report from Firestore: roster + each student's tenant-tree
 * progress (aggregated by buildCourseReport), plus reto completion signals
 * (RQ-PR14). The profesor reads per-student progress and reto state for their
 * own course (authorized by the nested isProfesorDe rule). The reto fan-out is
 * GATED: skipped entirely when the course has no reto assignments.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import { retoEstadoRepository } from '@features/dashboard/data/retoEstadoRepository';
import {
  buildCourseReport,
  type CourseReport,
  type RosterEntry,
} from '@features/dashboard/data/courseReport';
import type { RetoEstado, RetoFinancieroTipo } from '@shared/types/tenancy';

export interface RetoColumn {
  id: string;
  tipo: RetoFinancieroTipo;
  cantidad: number;
  deadline: number;
}

export interface CourseReportWithRetos extends CourseReport {
  retoColumns: RetoColumn[];
  /** uid → (retoId → estado). Ausencia = sin_empezar (nunca se escribe). */
  retoEstados: Record<string, Record<string, RetoEstado>>;
}

export async function loadCourseReport(
  colegioId: string,
  cursoId: string,
  cursoNombre: string,
  now: number
): Promise<CourseReportWithRetos> {
  const roster = await rosterRepository.getRoster(colegioId, cursoId);
  const progressArrays = await Promise.all(
    roster.map((s) => worldProgressRepository.getStudentProgress(colegioId, cursoId, s.uid))
  );
  const rosterEntries: RosterEntry[] = roster.map((s) => ({
    uid: s.uid,
    nombre: s.nombre,
    estado: s.estado,
  }));
  const base = buildCourseReport({
    colegioId,
    cursoId,
    cursoNombre,
    now,
    roster: rosterEntries,
    progress: progressArrays.flat(),
  });

  // 1 query para las asignaciones; el fan-out de señales por estudiante SOLO se
  // dispara si hay ≥1 reto (en cursos sin retos, cero reads extra).
  const asignaciones = await asignacionRepository.listByCurso(colegioId, cursoId);
  const retoColumns: RetoColumn[] = [];
  for (const a of asignaciones) {
    if (a.kind === 'reto') {
      retoColumns.push({
        id: a.id,
        tipo: a.reto.tipo,
        cantidad: a.reto.cantidad,
        deadline: a.deadline,
      });
    }
  }
  retoColumns.sort((x, y) => x.deadline - y.deadline);

  const retoEstados: Record<string, Record<string, RetoEstado>> = {};
  if (retoColumns.length > 0) {
    const signalArrays = await Promise.all(
      roster.map((s) => retoEstadoRepository.listByEstudiante(colegioId, cursoId, s.uid))
    );
    roster.forEach((s, i) => {
      const map: Record<string, RetoEstado> = {};
      for (const sig of signalArrays[i]) map[sig.retoId] = sig.estado;
      retoEstados[s.uid] = map;
    });
  }

  return { ...base, retoColumns, retoEstados };
}
