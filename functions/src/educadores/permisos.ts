/**
 * Fase 9 — el servidor hace cumplir el permiso del profe en la clase
 * (dominio/permisosClase.ts): quien ve y califica no opera la clase aunque
 * esté en `profesorUids`.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { permisoEnClase, puedeEnClase, type AccionClase } from './dominio/permisosClase';

/** Error si el profe no puede hacer `accion` en la clase (`curso` ya leído). */
export function exigirPermiso(curso: DocumentSnapshot, uid: string, accion: AccionClase): void {
  const datos = curso.exists ? curso.data() : undefined;
  const permiso = permisoEnClase(datos, uid);
  if (!permiso) throw new HttpsError('permission-denied', 'No es tu clase.');
  if (!puedeEnClase(datos, uid, accion)) {
    throw new HttpsError('permission-denied', 'En esta clase puedes ver y calificar, no cambiarla.', {
      codigo: 'solo_califica',
    });
  }
}

/** Lee la clase y exige el permiso. Devuelve la clase. */
export async function exigirEnClase(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  uid: string,
  accion: AccionClase
): Promise<DocumentSnapshot> {
  const curso = await db.doc(`colegios/${colegioId}/cursos/${cursoId}`).get();
  exigirPermiso(curso, uid, accion);
  return curso;
}
