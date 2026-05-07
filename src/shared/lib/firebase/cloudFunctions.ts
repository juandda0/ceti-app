import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';

const REGION = 'us-central1';

export function getFirebaseFunctionsInstance() {
  const clients = getFirebaseClients();
  if (!clients) return null;
  const fn = getFunctions(clients.app, REGION);
  if (__DEV__ && process.env.EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR === '1') {
    try {
      connectFunctionsEmulator(fn, 'localhost', 5001);
    } catch {
      /* ya conectado */
    }
  }
  return fn;
}

export async function callSyncUserClaims(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const f = getFirebaseFunctionsInstance();
  if (!f) return;
  const run = httpsCallable(f, 'syncUserClaims');
  await run({});
}

export async function callRedeemInvitation(
  code: string
): Promise<{ familyId: string; nickname: string }> {
  const f = getFirebaseFunctionsInstance();
  if (!f) throw new Error('Firebase no disponible');
  const run = httpsCallable(f, 'redeemInvitation');
  const res = await run({ code: code.trim().toUpperCase() });
  const d = res.data as { familyId?: string; nickname?: string };
  if (!d?.familyId) throw new Error('Respuesta inválida del servidor');
  return { familyId: d.familyId, nickname: d.nickname ?? '' };
}
