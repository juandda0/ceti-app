/**
 * Acceso a Órbita desde las pantallas: el uid de juego, el estado y su resumen
 * del día, y la apertura (escudos, interés, avisos) al entrar a la app.
 */
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { dayKey } from '@features/orbita/domain/tiempo';
import { resumen, type EstadoOrbita } from '@features/orbita/domain/orbita';
import { calcularRacha, practicoHoy } from '@features/orbita/domain/racha';
import { reprogramarAvisos } from '@features/orbita/data/avisosCeti';
import { eventos } from '@features/orbita/data/eventos';
import { useCetiOverlayStore } from '@shared/store/useCetiOverlayStore';

/** Mismo id que el resto del progreso: uid de Firebase o id local en demo. */
export function useUidJuego(): string {
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localId = useUserStore((s) => s.id);
  return firebaseUid ?? localId ?? '';
}

export function useOrbita() {
  const uid = useUidJuego();
  const estado = useOrbitaStore((s) => (uid ? s.porUid[uid] : undefined));
  useEffect(() => {
    if (uid && !estado) useOrbitaStore.getState().asegurar(uid);
  }, [uid, estado]);
  const hoy = dayKey(Date.now());
  const datos = useMemo(() => (estado ? resumen(estado, hoy) : null), [estado, hoy]);
  return { uid, estado, hoy, resumen: datos };
}

/** Vuelve a programar los avisos con el estado actual (después de practicar o de cambiar ajustes). */
export function refrescarAvisos(estado: EstadoOrbita | undefined, now = Date.now()): void {
  if (!estado) return;
  const hoy = dayKey(now);
  void reprogramarAvisos({
    activos: estado.ajustes.avisos,
    hoy,
    hora: estado.ajustes.horaAviso,
    practicoHoy: practicoHoy(estado.racha, hoy),
    racha: calcularRacha(estado.racha, hoy),
    now,
  });
}

/**
 * Montado una vez en las pestañas: al abrir la app (y al volver a ella) gasta
 * escudos si hace falta, paga el interés de la Bóveda, cobra CDT vencidos,
 * avisa lo que pasó y reprograma los avisos de Ceti.
 */
export function useAperturaOrbita(): void {
  const uid = useUidJuego();
  const { t } = useTranslation();
  useEffect(() => {
    if (!uid) return;
    const abrir = () => {
      const ev = useOrbitaStore.getState().abrir(uid);
      const toast = useCetiOverlayStore.getState().showToast;
      if (ev.escudosUsados > 0) {
        eventos.escudoUsado({ cantidad: ev.escudosUsados });
        toast({
          variant: 'success',
          title: t('orbita.apertura.escudoTitulo', { count: ev.escudosUsados }),
          message: t('orbita.apertura.escudoMensaje'),
          durationMs: 5000,
        });
      }
      if (ev.interes > 0) {
        eventos.interesPagado({ monto: ev.interes });
        toast({
          variant: 'success',
          title: t('orbita.apertura.interesTitulo', { cetis: ev.interes }),
          message: t('orbita.apertura.interesMensaje'),
          durationMs: 5000,
        });
      }
      if (ev.cdtsVencidos.length > 0) {
        toast({
          variant: 'success',
          title: t('orbita.apertura.cdtTitulo', { count: ev.cdtsVencidos.length }),
          message: t('orbita.apertura.cdtMensaje'),
          durationMs: 5000,
        });
      }
      if (ev.rotaReparable) {
        eventos.rachaPerdida({ racha: ev.rotaReparable.valor, reparable: true });
      }
      if (ev.rachaPerdida) {
        eventos.rachaPerdida({ racha: ev.rachaPerdida, reparable: false });
        toast({
          variant: 'info',
          title: t('orbita.apertura.perdidaTitulo', { count: ev.rachaPerdida }),
          message: t('orbita.apertura.perdidaMensaje'),
          durationMs: 6000,
        });
      }
      refrescarAvisos(useOrbitaStore.getState().porUid[uid]);
    };
    abrir();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') abrir();
    });
    return () => sub.remove();
  }, [uid, t]);
}
