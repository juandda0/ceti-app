import { setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { userWalletDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { Transaction } from '@features/savings/store/useWalletStore';

export type RemoteWalletState = {
  totalCetis: number;
  savedCetis: number;
  spentCetis: number;
  transactions: Transaction[];
  savingsGoal: import('@features/savings/store/useWalletStore').SavingsGoal | null;
  updatedAt: number;
};

export const walletRepository = {
  async setWalletState(uid: string, state: RemoteWalletState): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = userWalletDocRef(clients.firestore, uid);
    await setDoc(ref, stripUndefinedValues({ ...state } as Record<string, unknown>), {
      merge: true,
    });
    return true;
  },
};
