import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { calcularRacha, diasAprendiendo } from '@features/orbita/domain/racha';
import { dayKey } from '@features/orbita/domain/tiempo';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useAvatarStore } from '@features/avatar/store/useAvatarStore';
import { itemsCumplidos, type ProgresoAvatar } from '@features/avatar/domain/desbloqueos';
import {
  AVATAR_POR_DEFECTO,
  PRENDAS,
  personajePorId,
  type PrendaId,
} from '@features/avatar/domain/catalogo';
import { useCetiOverlayStore } from '@shared/store/useCetiOverlayStore';

const SIN_GANADOS: string[] = [];

/** Mismo id que usa Órbita: uid de Firebase o id local en demo. */
export function useAvatarUid(): string {
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localId = useUserStore((s) => s.id);
  return firebaseUid ?? localId;
}

export function useProgresoAvatar(): { uid: string; progreso: ProgresoAvatar; ganados: string[] } {
  const uid = useAvatarUid();
  // La racha y los días salen de Órbita (la racha única de la app, sincronizada).
  const racha = useOrbitaStore((s) => s.porUid[uid]?.racha);
  const goals = useSavingsStore((s) => s.goals);
  const ganados = useAvatarStore((s) => s.ganadosByUid[uid]) ?? SIN_GANADOS;
  const progreso = useMemo<ProgresoAvatar>(
    () => ({
      // La mejor racha (sincronizada) cuenta: lo ganado no se pierde al cambiar de teléfono.
      rachaQuiz: racha ? Math.max(calcularRacha(racha, dayKey(Date.now())), racha.mejor) : 0,
      diasAprendiendo: racha ? diasAprendiendo(racha) : 0,
      metasCumplidas: goals.filter((g) => g.completedAt != null && g.deletedAt == null).length,
    }),
    [racha, goals]
  );
  return { uid, progreso, ganados };
}

/**
 * Montado una vez en las pestañas: cuando el progreso cumple un requisito nuevo,
 * guarda el ítem como ganado y avisa con un toast.
 */
export function useVigilarDesbloqueos(): void {
  const { t } = useTranslation();
  const { uid, progreso } = useProgresoAvatar();
  const personaje = useUserStore((s) => s.avatar ?? AVATAR_POR_DEFECTO).personaje;
  useEffect(() => {
    if (!uid) return;
    const nuevos = useAvatarStore.getState().registrarGanados(uid, itemsCumplidos(progreso));
    for (const id of nuevos) {
      const esPrenda = PRENDAS.some((p) => p.id === id);
      // Una prenda sin dibujo para su tripulante queda ganada, pero no se anuncia todavía.
      if (esPrenda && !personajePorId(personaje).prendas[id as PrendaId]) continue;
      const item = t(esPrenda ? `avatar.prenda.${id}` : `avatar.accesorio.${id}`);
      useCetiOverlayStore.getState().showToast({
        variant: 'success',
        title: t('avatar.desbloqueo.titulo', { item }),
        message: t('avatar.desbloqueo.mensaje'),
        durationMs: 4500,
      });
    }
  }, [uid, progreso, personaje, t]);
}
