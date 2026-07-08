import { deleteDoc, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { userMovimientoDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

export const movimientosRepository = {
  async upsertMovimiento(uid: string, movimiento: Movimiento): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = userMovimientoDocRef(clients.firestore, uid, movimiento.id);
    await setDoc(ref, stripUndefinedValues({ ...movimiento } as Record<string, unknown>), {
      merge: true,
    });
    return true;
  },

  async removeMovimiento(uid: string, movimientoId: string): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await deleteDoc(userMovimientoDocRef(clients.firestore, uid, movimientoId));
    return true;
  },
};
