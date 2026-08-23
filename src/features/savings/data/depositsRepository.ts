import { deleteDoc, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { userDepositDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { SavingsDeposit } from '@features/savings/store/useSavingsStore';
import type { SavingsOperation } from '@features/savings/domain/savings';

export const depositsRepository = {
  async upsertOperation(uid: string, operation: SavingsOperation): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = userDepositDocRef(clients.firestore, uid, operation.id);
    await setDoc(ref, stripUndefinedValues({ ...operation } as Record<string, unknown>));
    return true;
  },
  async upsertDeposit(uid: string, deposit: SavingsDeposit): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = userDepositDocRef(clients.firestore, uid, deposit.id);
    await setDoc(ref, stripUndefinedValues({ ...deposit } as Record<string, unknown>), {
      merge: true,
    });
    return true;
  },

  async removeDeposit(uid: string, depositId: string): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await deleteDoc(userDepositDocRef(clients.firestore, uid, depositId));
    return true;
  },
};
