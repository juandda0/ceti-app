import { deleteDoc, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { userConfigPresupuestosDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { Presupuestos } from '@features/savings/data/presupuestos';

export const presupuestosRepository = {
  /**
   * Escribe el doc COMPLETO sin merge: un tope quitado desaparece del mapa. Un
   * merge profundo dejaría el tope viejo fantasma. RQ-ES11-CA1.
   */
  async guardar(uid: string, topes: Presupuestos): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = userConfigPresupuestosDocRef(clients.firestore, uid);
    await setDoc(
      ref,
      stripUndefinedValues({ topes, updatedAt: Date.now() } as Record<string, unknown>)
    );
    return true;
  },

  async borrar(uid: string): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await deleteDoc(userConfigPresupuestosDocRef(clients.firestore, uid));
    return true;
  },
};
