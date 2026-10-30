/**
 * Carga lo que necesita el análisis de la clase (Fase 3): quiénes siguen en la
 * clase y, de cada uno, sus intentos, visitas y avance; más los mundos, las
 * tareas y el texto de las preguntas. Lo lee el profe de la clase.
 */
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { registroClaseRepository } from '@features/dashboard/data/registroClaseRepository';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import { sigueEnClase } from '@features/dashboard/data/estadoRoster';
import { mundosDeLaClase, textosDeMundos } from '@features/dashboard/data/cargarFichaEstudiante';
import {
  SEMANAS_ACTIVIDAD,
  construirAnalisis,
  type AnalisisClase,
  type EstudianteDeLaClase,
} from '@features/dashboard/data/analisisClase';
import type { MundoDeLaClase } from '@features/dashboard/data/fichaEstudiante';
import type { Grado } from '@features/learning/data/quiz.types';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface AnalisisCargado {
  cursoNombre: string;
  mundos: MundoDeLaClase[];
  analisis: AnalisisClase;
}

export async function cargarAnalisisClase(
  colegioId: string,
  cursoId: string,
  { desde, hasta, ahora }: { desde: number; hasta: number; ahora: number }
): Promise<AnalisisCargado> {
  const [roster, curso, config, tareas] = await Promise.all([
    rosterRepository.getRoster(colegioId, cursoId),
    rosterRepository.getCurso(colegioId, cursoId),
    classConfigRepository.get(colegioId, cursoId).catch(() => null),
    asignacionRepository.listByCurso(colegioId, cursoId).catch(() => []),
  ]);
  const enClase = roster.filter((e) => sigueEnClase(e.estado));
  // La actividad muestra 8 semanas aunque el periodo sea más corto.
  const desdeCarga = Math.min(desde, ahora - SEMANAS_ACTIVIDAD * 7 * DIA_MS);

  const estudiantes: EstudianteDeLaClase[] = await Promise.all(
    enClase.map(async (e) => {
      const [intentos, visitas, progreso] = await Promise.all([
        registroClaseRepository.intentos(colegioId, cursoId, e.uid, desdeCarga).catch(() => []),
        registroClaseRepository.visitas(colegioId, cursoId, e.uid).catch(() => []),
        worldProgressRepository.getStudentProgress(colegioId, cursoId, e.uid).catch(() => []),
      ]);
      return {
        uid: e.uid,
        nombre: e.nombre,
        intentos,
        visitas,
        progreso: progreso.map((p) => ({
          worldId: p.worldId,
          mastery: p.mastery,
          completed: p.completed,
          completedAt: typeof p.completedAt === 'number' ? p.completedAt : undefined,
          updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : undefined,
        })),
      };
    })
  );

  const mundos = mundosDeLaClase(config);
  const worldIds = [...new Set(estudiantes.flatMap((e) => e.intentos.map((i) => i.worldId)))];
  const textos = await textosDeMundos(
    (curso?.grado as Grado | undefined) ?? null,
    worldIds,
    colegioId,
    cursoId,
    config
  );

  return {
    cursoNombre: curso?.nombre ?? '',
    mundos,
    analisis: construirAnalisis({ ahora, desde, hasta, estudiantes, mundos, textos, tareas }),
  };
}
