/**
 * Las clases de un estudiante (Fase 1): hasta 5 a la vez. Viajan en sus custom
 * claims como `clases: {cursoId: colegioId}`, que es lo que leen las reglas.
 * Los tokens de antes traen un solo par `colegioId`/`cursoId`; se leen igual.
 * Puro, salvo `clasesActuales`, que lee los claims vigentes en Auth (el token
 * de la llamada puede venir viejo si el estudiante se unió hace un momento).
 */
import { HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

export const MAX_CLASES_ESTUDIANTE = 5;

export type ClasesEstudiante = Record<string, string>;

/** Mapa {cursoId: colegioId} a partir de unos claims (nuevos o de antes). */
export function clasesDeClaims(
  claims: Record<string, unknown> | undefined | null
): ClasesEstudiante {
  const clases: ClasesEstudiante = {};
  const mapa = claims?.clases;
  if (mapa && typeof mapa === 'object' && !Array.isArray(mapa)) {
    for (const [cursoId, colegioId] of Object.entries(mapa as Record<string, unknown>)) {
      if (cursoId && typeof colegioId === 'string' && colegioId) clases[cursoId] = colegioId;
    }
  }
  const { colegioId, cursoId } = claims ?? {};
  if (
    claims?.role === 'estudiante' &&
    typeof colegioId === 'string' &&
    colegioId &&
    typeof cursoId === 'string' &&
    cursoId
  ) {
    clases[cursoId] = colegioId;
  }
  return clases;
}

/** Agrega una clase. Lanza `limite_clases_estudiante` si ya está en 5. */
export function conClase(
  clases: ClasesEstudiante,
  cursoId: string,
  colegioId: string
): ClasesEstudiante {
  if (clases[cursoId] === colegioId) return clases;
  if (Object.keys(clases).length >= MAX_CLASES_ESTUDIANTE) {
    throw new HttpsError(
      'resource-exhausted',
      `Ya estás en ${MAX_CLASES_ESTUDIANTE} clases. Sal de una para unirte a otra.`,
      { codigo: 'limite_clases_estudiante', limite: MAX_CLASES_ESTUDIANTE }
    );
  }
  return { ...clases, [cursoId]: colegioId };
}

export function sinClase(clases: ClasesEstudiante, cursoId: string): ClasesEstudiante {
  const resto = { ...clases };
  delete resto[cursoId];
  return resto;
}

/** Clases vigentes según Auth (no según el token de la llamada). */
export async function clasesActuales(uid: string): Promise<ClasesEstudiante> {
  try {
    return clasesDeClaims((await getAuth().getUser(uid)).customClaims);
  } catch {
    return {};
  }
}
