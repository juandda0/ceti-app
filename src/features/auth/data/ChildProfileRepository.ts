import { setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { childDocRef } from '@shared/lib/firebase/paths';

export type ChildRemoteProfile = {
  id: string;
  nickname: string;
  age: number;
  avatarEmoji: string;
  updatedAt: number;
};

export const childProfileRepository = {
  async saveProfile(familyId: string, profile: ChildRemoteProfile): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = childDocRef(clients.firestore, familyId, profile.id);
    await setDoc(ref, profile, { merge: true });
    return true;
  },

  async loadProfile(familyId: string, childId: string): Promise<ChildRemoteProfile | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(childDocRef(clients.firestore, familyId, childId));
    if (!snap.exists()) return null;
    return snap.data() as ChildRemoteProfile;
  },
};
