import { deleteDoc, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { userGoalDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { SavingsGoal } from '@features/savings/store/useSavingsStore';

export const goalsRepository = {
  async upsertGoal(uid: string, goal: SavingsGoal): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = userGoalDocRef(clients.firestore, uid, goal.id);
    await setDoc(ref, stripUndefinedValues({ ...goal } as Record<string, unknown>), {
      merge: true,
    });
    return true;
  },

  async removeGoal(uid: string, goalId: string): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await deleteDoc(userGoalDocRef(clients.firestore, uid, goalId));
    return true;
  },
};
