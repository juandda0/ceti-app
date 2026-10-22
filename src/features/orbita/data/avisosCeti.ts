/**
 * Adaptador de expo-notifications para los avisos de Ceti. El plan (cuándo y
 * qué) sale de domain/avisos; aquí solo se pide permiso y se programa.
 * En web no hace nada.
 */
import { Platform } from 'react-native';
import i18n from '@shared/i18n';
import { planearAvisos } from '@features/orbita/domain/avisos';
import { indiceDia } from '@features/orbita/domain/tiempo';

type Notificaciones = typeof import('expo-notifications');

const CANAL = 'ceti-avisos';
const BOGOTA_OFFSET_H = 5;

async function cargar(): Promise<Notificaciones | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

/** Pide permiso. Devuelve si quedó concedido. */
export async function pedirPermisoAvisos(): Promise<boolean> {
  const N = await cargar();
  if (!N) return false;
  try {
    const actual = await N.getPermissionsAsync();
    if (actual.granted) return true;
    if (!actual.canAskAgain) return false;
    const r = await N.requestPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}

/** Instante (ms) de `dia` a `hora` en Bogotá. */
function instanteBogota(dia: string, hora: number): number {
  return indiceDia(dia) * 24 * 3600 * 1000 + (hora + BOGOTA_OFFSET_H) * 3600 * 1000;
}

/**
 * Reprograma los avisos: borra los anteriores y programa los próximos días.
 * Con `activos` en false solo los borra.
 */
export async function reprogramarAvisos(input: {
  activos: boolean;
  hoy: string;
  hora: number;
  practicoHoy: boolean;
  racha: number;
  now?: number;
}): Promise<void> {
  const N = await cargar();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    if (!input.activos) return;
    const permiso = await N.getPermissionsAsync();
    if (!permiso.granted) return;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CANAL, {
        name: 'Ceti',
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    const now = input.now ?? Date.now();
    const horaActual = new Date(now - BOGOTA_OFFSET_H * 3600 * 1000).getUTCHours();
    const plan = planearAvisos({
      hoy: input.hoy,
      horaActual,
      hora: input.hora,
      practicoHoy: input.practicoHoy,
      racha: input.racha,
    });
    for (const aviso of plan) {
      const cuando = instanteBogota(aviso.dia, aviso.hora);
      if (cuando <= now) continue;
      await N.scheduleNotificationAsync({
        content: {
          title: 'Ceti',
          body: i18n.t(aviso.mensaje, aviso.params),
          data: { tipo: 'aviso_diario', mensaje: aviso.mensaje },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: new Date(cuando),
          channelId: CANAL,
        },
      });
    }
  } catch {
    /* sin módulo nativo (Expo Go viejo) o sin permiso: los avisos son opcionales */
  }
}
