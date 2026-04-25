// utils/storage.ts — AsyncStorage helpers para Ceti
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  HAS_ONBOARDED: 'ceti_has_onboarded',
  ACTIVE_PROFILE: 'ceti_active_profile',
} as const;

/**
 * Verifica si el usuario ya completó el onboarding
 */
export async function hasOnboarded(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.HAS_ONBOARDED);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Marca el onboarding como completado
 */
export async function setOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.HAS_ONBOARDED, 'true');
  } catch (error) {
    console.error('Error guardando estado de onboarding:', error);
  }
}

/**
 * Obtiene el perfil activo (child | parent | null)
 */
export async function getActiveProfile(): Promise<'child' | 'parent' | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
    if (value === 'child' || value === 'parent') return value;
    return null;
  } catch {
    return null;
  }
}

/**
 * Guarda el perfil activo
 */
export async function setActiveProfile(profile: 'child' | 'parent'): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profile);
  } catch (error) {
    console.error('Error guardando perfil activo:', error);
  }
}

/**
 * Limpia todos los datos de la app (para testing/reset)
 */
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.error('Error limpiando datos:', error);
  }
}
