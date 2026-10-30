import { getFirebaseClients } from '@shared/lib/firebase/app';
import { readCetiClaims } from '@shared/lib/firebase/claims';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { userRepository } from '@features/auth/data/userRepository';
import { AVATAR_POR_DEFECTO } from '@features/avatar/domain/catalogo';
import { adminService } from '@features/dashboard/data/adminService';
import { normalizeClassCode } from './classCode';

/** Re-reads the claims the Function just changed so the app sees the new class. */
async function refrescarClaims(): Promise<void> {
  const user = getFirebaseClients()?.auth.currentUser;
  if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

  await user.getIdToken(true);
  useAuthStore.getState().setClaims(await readCetiClaims(user, true));
}

/** Joins with the code; `nombreCompleto` is what the teacher sees in the class list. */
export async function joinClass(
  rawCode: string,
  nombreCompleto?: string
): Promise<{ colegioId: string; cursoId: string }> {
  const code = normalizeClassCode(rawCode);
  if (!code) throw new Error('Ingresa un código de clase.');

  const res = await adminService.joinByCode(code, nombreCompleto);
  await refrescarClaims();
  if (nombreCompleto) guardarNombreCompleto(nombreCompleto);
  return { colegioId: res.colegioId, cursoId: res.cursoId };
}

/** Keeps the full name in the profile so the next join is pre-filled. Never blocks the join. */
function guardarNombreCompleto(fullName: string): void {
  const store = useUserStore.getState();
  store.setProfile(store.nickname, fullName, store.avatar ?? AVATAR_POR_DEFECTO);
  const uid = getFirebaseClients()?.auth.currentUser?.uid;
  if (uid) void userRepository.updateFullName(uid, fullName).catch(() => undefined);
}

/** The student leaves their class; their streak, XP and avatar stay theirs. */
export async function leaveClass(): Promise<void> {
  await adminService.salirDeMiClase();
  await refrescarClaims();
}
