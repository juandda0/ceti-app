import { getFirebaseClients } from '@shared/lib/firebase/app';
import { readCetiClaims } from '@shared/lib/firebase/claims';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { adminService } from '@features/dashboard/data/adminService';
import { normalizeClassCode } from './classCode';

export async function joinClass(rawCode: string): Promise<void> {
  const code = normalizeClassCode(rawCode);
  if (!code) throw new Error('Ingresa un código de clase.');

  await adminService.joinByCode(code);
  const user = getFirebaseClients()?.auth.currentUser;
  if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

  await user.getIdToken(true);
  useAuthStore.getState().setClaims(await readCetiClaims(user, true));
}
