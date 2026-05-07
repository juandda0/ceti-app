import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { FIRESTORE_COLLECTIONS } from '@shared/lib/firebase/paths';

export type UserRole = 'parent' | 'child';

export type ChildProfileDraft = {
  nickname: string;
  fullName: string;
  age: number;
  avatarId: string;
  avatarEmoji: string;
  birthYear?: number;
  consentParent?: boolean;
};

export type RemoteUserDoc = {
  role: UserRole;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  phone?: string | null;
  familyId: string | null;
  provider: 'google' | 'apple' | 'unknown';
  childProfile?: ChildProfileDraft | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const userRepository = {
  async getUser(uid: string): Promise<RemoteUserDoc | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as RemoteUserDoc;
  },

  async upsertParentProfile(
    uid: string,
    data: {
      displayName: string;
      email: string | null;
      photoURL: string | null;
      phone?: string | null;
      provider: 'google' | 'apple' | 'unknown';
    }
  ): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    await setDoc(
      ref,
      {
        role: 'parent' as const,
        displayName: data.displayName,
        email: data.email,
        photoURL: data.photoURL,
        phone: data.phone ?? null,
        familyId: uid,
        provider: data.provider,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  },

  async upsertChildDraftProfile(
    uid: string,
    data: {
      displayName: string;
      email: string | null;
      photoURL: string | null;
      provider: 'google' | 'apple' | 'unknown';
      childProfile: ChildProfileDraft;
    }
  ): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    await setDoc(
      ref,
      {
        role: 'child' as const,
        displayName: data.displayName,
        email: data.email,
        photoURL: data.photoURL,
        familyId: null,
        provider: data.provider,
        childProfile: data.childProfile,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  },
};
