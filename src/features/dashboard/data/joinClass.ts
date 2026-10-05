import { getSessionUser, toCetiClaims } from '@shared/lib/auth/session';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { adminService } from '@features/dashboard/data/adminService';
import { normalizeClassCode } from './classCode';

export async function joinClass(rawCode: string): Promise<void> {
  const code = normalizeClassCode(rawCode);
  if (!code) throw new Error('Ingresa un código de clase.');
  await adminService.joinByCode(code);
  const user = await getSessionUser();
  if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  useAuthStore.getState().setClaims(toCetiClaims(user));
}
