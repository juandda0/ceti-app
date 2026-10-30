import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { FIRESTORE_COLLECTIONS } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { AvatarConfig } from '@features/avatar/domain/catalogo';

function providerFromAuthUser(u: User): 'google' | 'apple' | 'unknown' {
  if (u.providerData?.some((p) => p.providerId?.includes('google'))) return 'google';
  if (u.providerData?.some((p) => p.providerId?.includes('apple'))) return 'apple';
  return 'unknown';
}

export type UserProfileDraft = {
  nickname: string;
  fullName: string;
  avatarId: string;
  avatarEmoji: string;
  avatar?: AvatarConfig;
};

export type RemoteUserDoc = {
  displayName: string;
  email: string | null;
  photoURL: string | null;
  provider: 'google' | 'apple' | 'unknown';
  profile?: UserProfileDraft | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const userRepository = {
  async ensureUserStub(uid: string, authUser: User): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return;

    const existing = await this.getUser(uid);
    if (existing) return;

    const provider = providerFromAuthUser(authUser);
    const displayName =
      (authUser.displayName ?? '').trim() ||
      (authUser.email?.split('@')[0] ?? '').trim() ||
      'Usuario';

    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    await setDoc(
      ref,
      stripUndefinedValues({
        displayName,
        email: authUser.email ?? null,
        photoURL: authUser.photoURL ?? null,
        provider,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      } as Record<string, unknown>),
      { merge: true }
    );
  },

  async getUser(uid: string): Promise<RemoteUserDoc | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as RemoteUserDoc;
  },

  async upsertProfile(
    uid: string,
    data: {
      displayName: string;
      email: string | null;
      photoURL: string | null;
      provider: 'google' | 'apple' | 'unknown';
      profile: UserProfileDraft;
    }
  ): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    await setDoc(
      ref,
      stripUndefinedValues({
        displayName: data.displayName,
        email: data.email,
        photoURL: data.photoURL,
        provider: data.provider,
        profile: data.profile,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      } as Record<string, unknown>),
      { merge: true }
    );
    return true;
  },

  /** Guarda solo el avatar dentro de `profile`, sin tocar el resto del perfil. */
  async updateAvatar(uid: string, avatar: AvatarConfig): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    await setDoc(
      ref,
      { profile: { avatar, avatarId: avatar.personaje }, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return true;
  },

  /** Guarda solo el nombre completo (lo pide la app al unirse a una clase). */
  async updateFullName(uid: string, fullName: string): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid);
    await setDoc(ref, { profile: { fullName }, updatedAt: serverTimestamp() }, { merge: true });
    return true;
  },
};
