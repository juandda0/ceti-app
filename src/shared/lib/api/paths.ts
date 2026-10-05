import { seg } from '@shared/lib/api/client';

/** Raíz REST de un curso: `/api/colegios/{cid}/cursos/{cursoId}`. */
export function cursoPath(colegioId: string, cursoId: string): string {
  return `/api/colegios/${seg(colegioId)}/cursos/${seg(cursoId)}`;
}

export function estudiantePath(colegioId: string, cursoId: string, uid: string): string {
  return `${cursoPath(colegioId, cursoId)}/estudiantes/${seg(uid)}`;
}

/** Ids del contenido propio de un curso (RQ-PR11); también los valida el backend. */
export const contenidoDocId = {
  banco: (worldId: string, tipo: string) => `banco_${worldId}_${tipo}`,
  microteoria: (worldId: string) => `microteoria_${worldId}`,
  eligeCamino: (worldId: string) => `eligeCamino_${worldId}`,
};

/** Bancos globales (R8). Ids: `${grado}_${worldId}_${tipo}` y `${grado}_${worldId}`. */
export const contentPath = {
  banco: (grado: string, worldId: string, tipo: string) =>
    `/api/content/bancos/${seg(`${grado}_${worldId}_${tipo}`)}`,
  eligeCamino: (grado: string, worldId: string) =>
    `/api/content/elige-camino/${seg(`${grado}_${worldId}`)}`,
  microteoria: (grado: string, worldId: string) =>
    `/api/content/microteoria/${seg(`${grado}_${worldId}`)}`,
};
