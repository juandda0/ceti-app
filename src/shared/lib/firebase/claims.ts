/**
 * Reads Ceti custom claims (role, colegioId, cursoId) from the Firebase Auth
 * token. Claims are set by Cloud Functions (see functions/) and are the only
 * trusted source of role/tenant; the client mirrors them for routing/UI only.
 * No pseudonym or sede claims exist (R1/R2).
 */
import { getIdTokenResult, type User } from 'firebase/auth';
import { isRole, type CetiClaims } from '@shared/types/tenancy';

/**
 * Returns the user's Ceti claims, or null if the account has no role yet (a
 * fresh OAuth sign-in before joining a course or before an admin assigns a role).
 * `admin` is global and carries no `colegioId`; every other role requires one.
 * Pass `forceRefresh` after a claims change to bypass the cached token.
 */
export async function readCetiClaims(user: User, forceRefresh = false): Promise<CetiClaims | null> {
  try {
    const result = await getIdTokenResult(user, forceRefresh);
    const c = result.claims as Record<string, unknown>;
    if (!isRole(c.role)) return null;
    const colegioId =
      typeof c.colegioId === 'string' && c.colegioId.length > 0 ? c.colegioId : undefined;
    // Only `admin` may lack a colegioId; everyone else must have one.
    if (c.role !== 'admin' && !colegioId) return null;
    return {
      role: c.role,
      colegioId,
      cursoId: typeof c.cursoId === 'string' && c.cursoId.length > 0 ? c.cursoId : undefined,
    };
  } catch {
    return null;
  }
}
