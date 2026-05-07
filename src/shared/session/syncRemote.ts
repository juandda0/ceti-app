import { isFirebaseConfigured } from '@shared/lib/firebase/app';
import { useParentStore } from '@features/family/store/useParentStore';
import { childProfileRepository } from '@features/auth/data/ChildProfileRepository';
import { snapshotActiveChildFromStore } from '@features/auth/store/useChildrenRegistryStore';

import { useAuthStore } from '@features/auth/store/useAuthStore';

/** Sube el perfil infantil activo a Firestore (si Firebase y familyId están listos). */
export async function pushActiveChildProfileRemote(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const auth = useAuthStore.getState();
  const familyId =
    auth.userRole === 'child' && auth.linkedFamilyId
      ? auth.linkedFamilyId
      : useParentStore.getState().familyId;
  if (!familyId) return;
  const snap = snapshotActiveChildFromStore();
  if (!snap) return;
  await childProfileRepository.saveProfile(familyId, {
    id: snap.id,
    nickname: snap.nickname,
    age: snap.age,
    avatarEmoji: snap.avatarEmoji || '',
    updatedAt: Date.now(),
  });
}

/** Punto único para “sembrar” datos locales en la nube cuando exista backend. */
export async function seedLocalDataToRemoteIfNeeded(): Promise<void> {
  await pushActiveChildProfileRemote();
}
