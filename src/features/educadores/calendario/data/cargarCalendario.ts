/**
 * Fase 9 — carga lo que tiene fecha en una clase y lo convierte en eventos
 * (dominio/calendarioClase.ts). El profe ve todo; el estudiante, sus tareas,
 * los mundos que se abren, la prueba y los periodos (sin cifras de nadie).
 */
import {
  eventosDeClase,
  leerRequisitos,
  periodosDelAnio,
  type ConfigEvaluacion,
  type EventoClase,
  type FuentesCalendario,
} from '@/functions/src/educadores/dominio';
import { fechaBogota } from '@/functions/src/educadores/dominio/calendario';
import { asignacionRepository, type AsignacionWithId } from '@features/dashboard/data/asignacionRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import { cumplimientoRepository } from '@features/educadores/cumplimiento/data/cumplimientoRepository';
import { vivoRepository, type ResumenSesionVivo } from '@features/educadores/vivo/data/vivoRepository';

export async function cargarCalendario(p: {
  colegioId: string;
  cursoId: string;
  /** Estudiante: solo sus tareas. Profe: null. */
  estudianteUid: string | null;
  evaluacion: ConfigEvaluacion | null;
  ahora: number;
}): Promise<EventoClase[]> {
  const { colegioId, cursoId, estudianteUid, ahora } = p;
  const [config, tareas, prueba, vivo] = await Promise.all([
    classConfigRepository.get(colegioId, cursoId).catch(() => null),
    (estudianteUid
      ? asignacionRepository.listForStudent(colegioId, cursoId, estudianteUid)
      : asignacionRepository.listByCurso(colegioId, cursoId)
    ).catch(() => [] as AsignacionWithId[]),
    cumplimientoRepository.configPrueba(colegioId, cursoId).catch(() => null),
    estudianteUid
      ? Promise.resolve([] as ResumenSesionVivo[])
      : vivoRepository.historial(colegioId, cursoId).catch(() => [] as ResumenSesionVivo[]),
  ]);
  const entradas = config?.mundos ?? [];
  const nombre = (worldId: string) => displayWorldDef(worldId, entradas.find((e) => e.worldId === worldId))?.name ?? worldId;
  const anio = Number(fechaBogota(ahora).slice(0, 4));
  const fuentes: FuentesCalendario = {
    tareas: tareas.map((t) => ({
      id: t.id,
      titulo: 'worldId' in t && t.worldId ? nombre(t.worldId) : 'un reto de plata',
      deadline: t.deadline,
    })),
    mundosConFecha: entradas
      .filter((e) => e.activo)
      .map((e) => ({ e, r: leerRequisitos(e.requisitos) }))
      .filter((x) => !!x.r?.desde)
      .map(({ e, r }) => ({ worldId: e.worldId, nombre: nombre(e.worldId), desde: r!.desde! })),
    prueba,
    vivo: vivo.map((v) => ({ id: v.id, titulo: v.titulo ?? '', creadoAt: v.creadoAt })),
    periodos: [...periodosDelAnio(p.evaluacion, anio - 1), ...periodosDelAnio(p.evaluacion, anio), ...periodosDelAnio(p.evaluacion, anio + 1)],
  };
  return eventosDeClase(fuentes, ahora);
}
