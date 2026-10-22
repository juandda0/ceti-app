/**
 * Acceso con correo y contraseña. Solo para el equipo: probar cuentas con
 * distintos roles sin pasar por Google. Los errores salen en español y dicen qué
 * hacer.
 */
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseClients } from '@shared/lib/firebase/app';

function mensaje(e: unknown): Error {
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
  switch (code) {
    case 'auth/invalid-email':
      return new Error('Ese correo no es válido.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Correo o contraseña incorrectos.');
    case 'auth/email-already-in-use':
      return new Error('Ya existe una cuenta con ese correo. Usa "Entrar".');
    case 'auth/weak-password':
      return new Error('La contraseña debe tener al menos 6 caracteres.');
    case 'auth/too-many-requests':
      return new Error('Demasiados intentos. Espera un momento y vuelve a intentar.');
    case 'auth/operation-not-allowed':
      return new Error(
        'El acceso con correo está apagado. Actívalo en Firebase → Authentication → Sign-in method → Correo/contraseña.'
      );
    case 'auth/network-request-failed':
      return new Error('Sin conexión con Firebase. Revisa la red e inténtalo de nuevo.');
    default:
      return e instanceof Error ? e : new Error(String(e));
  }
}

function auth() {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Configura Firebase (EXPO_PUBLIC_FIREBASE_*)');
  return clients.auth;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth(), email.trim(), password);
  } catch (e) {
    throw mensaje(e);
  }
}

export async function createAccountWithEmail(email: string, password: string): Promise<void> {
  try {
    await createUserWithEmailAndPassword(auth(), email.trim(), password);
  } catch (e) {
    throw mensaje(e);
  }
}
