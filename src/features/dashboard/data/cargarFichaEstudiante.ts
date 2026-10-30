/**
 * Carga todo lo que necesita la ficha del estudiante (Fase 2) y la arma con
 * `construirFicha`. Lo lee el profe de la clase (las reglas solo se lo dejan a
 * él). `desde` recorta el historial: Cadete ve los últimos 7 días.
 */
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { rosterRepository, type EstudianteWithId } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { registroClaseRepository } from '@features/dashboard/data/registroClaseRepository';
import {
  construirFicha,
  type Ficha,
  type MundoDeLaClase,
  type TextoPregunta,
} from '@features/dashboard/data/fichaEstudiante';
import { resolveClassWorlds } from '@features/learning/data/classConfig';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import {
  COMPETENCIA_PERSONALIZADA,
  competenciaForWorld,
} from '@features/learning/data/competencias';
import { questionBankRepository } from '@features/learning/data/QuestionBankRepository';
import type { Grado } from '@features/learning/data/quiz.types';
import type { CursoConfigMundos } from '@shared/types/tenancy';

export interface FichaCargada {
  estudiante: EstudianteWithId | null;
  cursoNombre: string;
  mundos: MundoDeLaClase[];
  ficha: Ficha;
}

/** Los mundos que la clase ve hoy, en su orden, con nombre y competencia. */
export function mundosDeLaClase(config: CursoConfigMundos | null): MundoDeLaClase[] {
  const entradas = new Map((config?.mundos ?? []).map((m) => [m.worldId, m]));
  return resolveClassWorlds(config, () => false).worlds.map(({ worldId }) => {
    const entrada = entradas.get(worldId);
    return {
      id: worldId,
      nombre: displayWorldDef(worldId, entrada)?.name ?? entrada?.nombre ?? worldId,
      competencia:
        entrada?.competencia ?? competenciaForWorld(worldId)?.id ?? COMPETENCIA_PERSONALIZADA,
    };
  });
}

export async function textosDeMundos(
  grado: Grado | null,
  worldIds: string[],
  colegioId: string,
  cursoId: string,
  config: CursoConfigMundos | null
): Promise<Map<string, TextoPregunta>> {
  const textos = new Map<string, TextoPregunta>();
  if (!grado) return textos;
  // Primero el banco de Ceti y después el de la clase: si el profe cambió una
  // pregunta que el estudiante ya había respondido, igual se ve su texto.
  const pools = await Promise.all(
    worldIds.flatMap((w) => [
      questionBankRepository.fetchPool(grado, w, null).catch(() => null),
      config?.overrides?.[w]
        ? questionBankRepository
            .fetchPool(grado, w, {
              colegioId,
              cursoId,
              overrides: config.overrides[w],
              version: config.version ?? 0,
            })
            .catch(() => null)
        : Promise.resolve(null),
    ])
  );
  for (const pool of pools) {
    if (!pool) continue;
    for (const q of pool.mc) {
      textos.set(q.id, { enunciado: q.enunciado, tipo: q.tipo, opciones: q.opciones });
    }
    for (const q of pool.vf) textos.set(q.id, { enunciado: q.enunciado, tipo: q.tipo });
    for (const q of pool.ordenar) {
      textos.set(q.id, { enunciado: q.enunciado, tipo: q.tipo, elementos: q.elementos });
    }
  }
  return textos;
}

export async function cargarFichaEstudiante(
  colegioId: string,
  cursoId: string,
  uid: string,
  { desde, ahora }: { desde: number; ahora: number }
): Promise<FichaCargada> {
  const [estudiante, curso, config, progreso, intentos, visitas, orbita] = await Promise.all([
    rosterRepository.getEstudiante(colegioId, cursoId, uid),
    rosterRepository.getCurso(colegioId, cursoId),
    classConfigRepository.get(colegioId, cursoId).catch(() => null),
    worldProgressRepository.getStudentProgress(colegioId, cursoId, uid).catch(() => []),
    registroClaseRepository.intentos(colegioId, cursoId, uid, desde).catch(() => []),
    registroClaseRepository.visitas(colegioId, cursoId, uid).catch(() => []),
    registroClaseRepository.resumenOrbita(colegioId, cursoId, uid).catch(() => null),
  ]);

  const mundos = mundosDeLaClase(config);
  const worldIds = [...new Set(intentos.map((i) => i.worldId))];
  const [textos, agregados] = await Promise.all([
    textosDeMundos(
      (curso?.grado as Grado | undefined) ?? null,
      worldIds,
      colegioId,
      cursoId,
      config
    ),
    Promise.all(
      worldIds.map((w) =>
        registroClaseRepository.preguntasDeMundo(colegioId, cursoId, w).catch(() => ({}))
      )
    ),
  ]);

  // Acierto de la clase en las mismas preguntas que respondió este estudiante.
  const suyas = new Set(intentos.flatMap((i) => i.respuestas.map((r) => r.p)));
  let vistas = 0;
  let aciertos = 0;
  for (const porPregunta of agregados) {
    for (const [p, s] of Object.entries(porPregunta)) {
      if (!suyas.has(p)) continue;
      vistas += s.vistas ?? 0;
      aciertos += s.aciertos ?? 0;
    }
  }

  const ficha = construirFicha({
    ahora,
    intentos,
    visitas: visitas.filter((v) => v.ultimaAt >= desde),
    progreso: progreso.map((p) => ({
      worldId: p.worldId,
      mastery: p.mastery,
      completed: p.completed,
      competencia: p.competencia,
      completedAt: typeof p.completedAt === 'number' ? p.completedAt : undefined,
    })),
    orbita,
    mundos,
    textos,
    aciertoClase: vistas > 0 ? aciertos / vistas : null,
  });
  return { estudiante, cursoNombre: curso?.nombre ?? '', mundos, ficha };
}
