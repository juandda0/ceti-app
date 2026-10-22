/**
 * Adopción del colegio para la pestaña Colegio: cursos, agregados por curso y,
 * de las clases propias, el tamaño de la lista. Solo agregados; de las clases
 * ajenas nunca se lee la lista.
 */
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { agregadosRepository } from '@features/dashboard/data/agregadosRepository';
import { calcularAdopcion, type Adopcion } from '@/functions/src/educadores/dominio';
import { cursosAdopcionDesdeColegio, type ResumenAdopcion } from './adopcionCursos';

export async function cargarAdopcion(
  colegioId: string,
  uid: string,
  ahora: number
): Promise<Adopcion> {
  // Si las reglas no dejan listar todos los cursos, al menos las clases propias.
  const cursos: CursoWithId[] = await rosterRepository
    .getAllCursos(colegioId)
    .catch(() => rosterRepository.getCursosByProfesor(colegioId, uid));
  const detalle = await Promise.all(
    cursos.map(async (c) => {
      const propio = (c.profesorUids ?? []).includes(uid);
      const [resumen, lista] = await Promise.all([
        agregadosRepository.getResumen(colegioId, c.id).catch(() => null),
        propio
          ? rosterRepository.getRoster(colegioId, c.id).catch(() => null)
          : Promise.resolve(null),
      ]);
      return {
        id: c.id,
        profesorUids: c.profesorUids ?? [],
        resumen: resumen as ResumenAdopcion | null,
        totalLista: lista ? lista.filter((e) => e.estado !== 'suprimido').length : null,
      };
    })
  );
  return calcularAdopcion(cursosAdopcionDesdeColegio(detalle, ahora), ahora);
}
