/**
 * Reads Ceti custom claims (role, colegioId, sedeId, studentId) from the Firebase
 * Auth token. Claims are set by Cloud Functions (see functions/) and are the only
 * trusted source of role/tenant; the client mirrors them for routing/UI only.
 */
import { getIdTokenResult, type User } from 'firebase/auth';
import { isRole, type CetiClaims } from '@shared/types/tenancy';

/**
 * Returns the user's Ceti claims, or null if the account has not been provisioned
 * (no role/colegio yet — e.g. a fresh Google sign-in before staff assigns a role).
 * Pass `forceRefresh` after a claims change to bypass the cached token.
 */
export async function readCetiClaims(user: User, forceRefresh = false): Promise<CetiClaims | null> {
  try {
    const result = await getIdTokenResult(user, forceRefresh);
    const c = result.claims as Record<string, unknown>;
    if (!isRole(c.role)) return null;
    if (typeof c.colegioId !== 'string' || c.colegioId.length === 0) return null;
    return {
      role: c.role,
      colegioId: c.colegioId,
      sedeId: typeof c.sedeId === 'string' && c.sedeId.length > 0 ? c.sedeId : undefined,
      studentId:
        typeof c.studentId === 'string' && c.studentId.length > 0 ? c.studentId : undefined,
    };
  } catch {
    return null;
  }
}
