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
    await setDoc(
      ref,
      stripUndefinedValues({
        id: movimiento.id,
        tipo: 'gasto',
        monto: movimiento.monto,
        descripcion: movimiento.descripcion,
        categoria: movimiento.categoria,
        origen: movimiento.origen,
        fecha: movimiento.fecha ?? movimiento.createdAt,
        createdAt: movimiento.createdAt,
        updatedAt: movimiento.updatedAt ?? movimiento.createdAt,
      })
    );
    return true;
  },

  async removeMovimiento(uid: string, movimientoId: string): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await deleteDoc(userMovimientoDocRef(clients.firestore, uid, movimientoId));
    return true;
  },
};
