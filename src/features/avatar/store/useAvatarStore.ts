/**
 * Ítems del avatar ganados, por usuario y en el dispositivo (igual que la racha
 * de quizzes de la que salen). No se suben a Firestore: dirían cuántos días
 * seguidos estudió la persona (R5). Lo que sí viaja con el perfil es el avatar
 * elegido (useUserStore.avatar).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';

type AvatarStoreState = {
  ganadosByUid: Record<string, string[]>;
  /** Suma ítems ganados y devuelve solo los nuevos. */
  registrarGanados: (uid: string, ids: readonly string[]) => string[];
};

export const useAvatarStore = create<AvatarStoreState>()(
  persist(
    (set, get) => ({
      ganadosByUid: {},
      registrarGanados: (uid, ids) => {
        const prev = get().ganadosByUid[uid] ?? [];
        const nuevos = ids.filter((id) => !prev.includes(id));
        if (nuevos.length > 0) {
          set((s) => ({ ganadosByUid: { ...s.ganadosByUid, [uid]: [...prev, ...nuevos] } }));
        }
        return nuevos;
      },
    }),
    {
      name: 'avatar-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
