/**
 * Fase 5 — push en el celular: si el usuario ya dio permiso de avisos, guarda
 * su token de Expo en `notificaciones/{uid}` para que el servidor le mande los
 * mensajes del profe (estudiante) o las alertas de la clase (profe). Al tocar
 * el push abre la ruta que trae. En web no hace nada.
 *
 * No pide permiso por su cuenta: el estudiante lo da en los avisos de Órbita y
 * el profe con `pedirPushEnEsteCelular` (ajustes de alertas).
 *
 * Sin verificar en un celular real: necesita un build nativo (EAS) y el
 * projectId de EAS; en el emulador y en web no llega ningún push.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { avisosRepository } from '@features/dashboard/data/avisosRepository';
import { pedirPermisoAvisos } from '@features/orbita/data/avisosCeti';

type Notificaciones = typeof import('expo-notifications');

async function cargar(): Promise<Notificaciones | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

function projectIdEas(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function registrar(uid: string, N: Notificaciones): Promise<void> {
  const permiso = await N.getPermissionsAsync();
  if (!permiso.granted) return;
  const projectId = projectIdEas();
  const { data } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  if (data) await avisosRepository.guardarToken(uid, data);
}

/** Pide permiso y registra este celular. Devuelve si quedó listo. */
export async function pedirPushEnEsteCelular(uid: string): Promise<boolean> {
  const N = await cargar();
  if (!N) return false;
  const ok = await pedirPermisoAvisos();
  if (!ok) return false;
  await registrar(uid, N).catch(() => undefined);
  return true;
}

export function usePushCeti(): void {
  const uid = useAuthStore((s) => s.firebaseUid);
  const router = useRouter();

  useEffect(() => {
    if (!uid) return;
    let quitar: (() => void) | null = null;
    let cancelado = false;
    void cargar().then((N) => {
      if (!N || cancelado) return;
      void registrar(uid, N).catch(() => undefined);
      const sub = N.addNotificationResponseReceivedListener((r) => {
        const ruta = r.notification.request.content.data?.ruta;
        if (typeof ruta === 'string' && ruta.startsWith('/')) router.push(ruta as Href);
      });
      quitar = () => sub.remove();
    });
    return () => {
      cancelado = true;
      quitar?.();
    };
  }, [uid, router]);
}
