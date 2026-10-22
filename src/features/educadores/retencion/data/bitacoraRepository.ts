/**
 * La Bitácora que guarda el servidor cada domingo (`bitacoraSemanal`) en
 * `bitacoras/{uid}/semanas/{semanaIso}`. Solo la lee su dueño. La app calcula la
 * semana en vivo; esta copia es el respaldo cuando no puede calcularla.
 */
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import type { Bitacora } from '@/functions/src/educadores/dominio';

export const bitacoraRepository = {
  async leerSemana(uid: string, semana: string): Promise<Bitacora | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(doc(clients.firestore, 'bitacoras', uid, 'semanas', semana));
    return snap.exists() ? (snap.data() as Bitacora) : null;
  },
};
