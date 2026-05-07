import { doc, setDoc, getDoc, type Firestore } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { familyDocPath } from '@shared/lib/firebase/paths';

export type FamilySeed = {
  id: string;
  parentUid: string;
  parentDisplayName?: string;
  createdAt: number;
};

export const familyRepository = {
  async upsertSeed(familyId: string, data: FamilySeed): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = doc(clients.firestore, familyDocPath(familyId));
    await setDoc(
      ref,
      { ...data, parentUid: data.parentUid ?? familyId, updatedAt: Date.now() },
      { merge: true }
    );
    return true;
  },

  async getSeed(familyId: string): Promise<FamilySeed | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(doc(clients.firestore, familyDocPath(familyId)));
    if (!snap.exists()) return null;
    return snap.data() as FamilySeed;
  },
};

export function getFirestoreOrNull(): Firestore | null {
  return getFirebaseClients()?.firestore ?? null;
}
