/**
 * Sesión contra el backend: login (Google → token propio), lectura de la cuenta
 * y cierre. Rol/tenant los fija SOLO el servidor; el cliente los refleja para
 * enrutar la UI (R2).
 */
import { api, ApiError, isBackendConfigured } from '@shared/lib/api/client';
import { tokenStore } from '@shared/lib/auth/tokenStore';
import { isRole, type CetiClaims, type Role } from '@shared/types/tenancy';

export type SessionProfile = {
  nickname: string;
  fullName: string;
  avatarId: string;
  avatarEmoji: string;
};

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  provider: string;
  profile: SessionProfile | null;
  role: Role | null;
  colegioId: string | null;
  cursoId: string | null;
};

type SessionResponse = { token: string; user: SessionUser };

/**
 * Claims de la cuenta, o null si aún no tiene rol útil. `admin` es global y no
 * lleva colegio; cualquier otro rol sin colegio (invitado) cuenta como sin rol.
 */
export function toCetiClaims(user: Pick<SessionUser, 'role' | 'colegioId' | 'cursoId'>): CetiClaims | null {
  if (!isRole(user.role)) return null;
  const colegioId = user.colegioId || undefined;
  if (user.role !== 'admin' && !colegioId) return null;
  return { role: user.role, colegioId, cursoId: user.cursoId || undefined };
}

/** Cuenta de la sesión guardada; null si no hay sesión o expiró. Lanza si no hay red. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isBackendConfigured()) return null;
  if (!(await tokenStore.get())) return null;
  try {
    return await api.get<SessionUser>('/api/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      await tokenStore.clear();
      return null;
    }
    throw e;
  }
}

export async function startSession(path: string, body: unknown): Promise<SessionUser> {
  const res = await api.post<SessionResponse>(path, body);
  await tokenStore.set(res.token);
  return res.user;
}

/** Solo desarrollo/E2E: el backend lo rechaza salvo CETI_DEV_LOGIN=true. */
export function signInDev(email: string): Promise<SessionUser> {
  return startSession('/api/auth/dev', { email, name: email.split('@')[0] });
}

export async function clearSession(): Promise<void> {
  await tokenStore.clear();
}
