/**
 * La adopción del colegio que calcula el servidor (`adopcionColegio.ts`) en
 * `colegios/{cid}/agregados/adopcion`. Solo cifras; la lee cualquier profe del
 * colegio, aunque no vea las clases de los demás.
 */
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { adopcionDesdeAgregado, type AdopcionPanel } from './adopcionCursos';

export const adopcionRepository = {
  /** null si aún no existe (el servidor no ha corrido) o no trae las cifras. */
  async leerAgregado(colegioId: string): Promise<AdopcionPanel | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(doc(clients.firestore, 'colegios', colegioId, 'agregados', 'adopcion'));
    return snap.exists() ? adopcionDesdeAgregado(snap.data()) : null;
  },
};
