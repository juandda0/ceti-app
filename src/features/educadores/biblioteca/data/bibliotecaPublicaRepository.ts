/**
 * Fase 8c — biblioteca pública de mundos, lado cliente (ver
 * functions/src/educadores/dominio/bibliotecaPublica.ts). Se leen las fichas
 * visibles y las propias; todo cambio pasa por los callables.
 */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type { FichaPublica } from '@/functions/src/educadores/dominio';

export type FichaConId = FichaPublica & { id: string };

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Sin conexión con Firebase.');
  return c.firestore;
}

const col = () => collection(db(), 'bibliotecaPublica');
const conId = (d: { id: string; data: () => unknown }) => ({ id: d.id, ...(d.data() as FichaPublica) });

export const bibliotecaPublicaRepository = {
  /** Las visibles y las del profe (aunque estén en revisión), sin repetir. */
  async listar(uid: string): Promise<FichaConId[]> {
    const [visibles, mias] = await Promise.all([
      getDocs(query(col(), where('oculto', '==', false), limit(300))),
      getDocs(query(col(), where('autorUid', '==', uid), limit(50))),
    ]);
    const todas = new Map<string, FichaConId>();
    for (const d of [...visibles.docs, ...mias.docs]) todas.set(d.id, conId(d));
    return [...todas.values()];
  },

  publicar: (cursoId: string, worldId: string, mostrarInstitucion: boolean) =>
    callFunction<{ ok: true; id: string }>('publicarEnBibliotecaPublica', { cursoId, worldId, mostrarInstitucion }),
  usar: (id: string, cursoId: string) => callFunction<{ ok: true; worldId: string }>('usarDeBibliotecaPublica', { id, cursoId }),
  reportar: (id: string, motivo: string) => callFunction<{ ok: true; oculto: boolean }>('reportarPublicacion', { id, motivo }),
  retirar: (id: string) => callFunction<{ ok: true }>('retirarDeBibliotecaPublica', { id }),
};
