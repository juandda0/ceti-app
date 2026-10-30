import type { EstudianteEstado } from '@shared/types/tenancy';

/** Roster states that are still in the class (and take a seat). Mirrors the server. */
export function sigueEnClase(estado: EstudianteEstado): boolean {
  return estado === 'activo' || estado === 'pendiente_atestacion';
}
