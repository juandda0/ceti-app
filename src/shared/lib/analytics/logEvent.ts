/**
 * Analytics de producto. Firebase Analytics en builds nativos; no-op en web o si el módulo no enlaza.
 */
import { Platform } from 'react-native';

export async function logEvent(name: string, params: Record<string, unknown> = {}): Promise<void> {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', name, params);
    return;
  }
  if (Platform.OS === 'web') return;
  try {
    const analytics = (await import('@react-native-firebase/analytics')).default;
    await analytics().logEvent(name, params);
  } catch {
    /* módulo no enlazado o entorno de prueba */
  }
}
