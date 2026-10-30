/**
 * La adopción del colegio que calcula el servidor (`adopcionColegio.ts`) en
 * `colegios/{cid}/agregados/adopcion`. Solo cifras; la lee cualquier profe del
 * colegio, aunque no vea las clases de los demás.
 */
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import type { CursoMeta } from '@features/dashboard/data/schoolReport';
import { adopcionDesdeAgregado, type AdopcionPanel } from './adopcionCursos';

async function leerDoc(colegioId: string) {
  const clients = getFirebaseClients();
  if (!clients?.firestore) return null;
  const snap = await getDoc(doc(clients.firestore, 'colegios', colegioId, 'agregados', 'adopcion'));
  return snap.exists() ? snap.data() : null;
}

export const adopcionRepository = {
  /** null si aún no existe (el servidor no ha corrido) o no trae las cifras. */
  async leerAgregado(colegioId: string): Promise<AdopcionPanel | null> {
    const datos = await leerDoc(colegioId);
    return datos ? adopcionDesdeAgregado(datos) : null;
  },

  /**
   * Las clases del colegio entero (id, nombre y grado) que guarda el mismo
   * agregado. null si aún no existe o es de antes de que trajera la lista.
   */
  async leerCursos(colegioId: string): Promise<CursoMeta[] | null> {
    const lista = (await leerDoc(colegioId))?.listaCursos;
    if (!Array.isArray(lista)) return null;
    return lista.flatMap((c: unknown) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return typeof o.id === 'string'
        ? [
            {
              id: o.id,
              nombre: typeof o.nombre === 'string' ? o.nombre : o.id,
              grado: typeof o.grado === 'string' ? o.grado : '',
            },
          ]
        : [];
    });
  },
};
