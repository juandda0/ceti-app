/**
 * Reads Ceti custom claims (role, colegioId, cursoId) from the Firebase Auth
 * token. Claims are set by Cloud Functions (see functions/) and are the only
 * trusted source of role/tenant; the client mirrors them for routing/UI only.
 * No pseudonym or sede claims exist (R1/R2).
 */
import { getIdTokenResult, type User } from 'firebase/auth';
import { isRole, type CetiClaims } from '@shared/types/tenancy';

/** {cursoId: colegioId} from a student token: the `clases` map, or the legacy pair. */
export function clasesDeClaims(c: Record<string, unknown>): Record<string, string> {
  const clases: Record<string, string> = {};
  if (c.clases && typeof c.clases === 'object' && !Array.isArray(c.clases)) {
    for (const [cursoId, colegioId] of Object.entries(c.clases as Record<string, unknown>)) {
      if (cursoId && typeof colegioId === 'string' && colegioId) clases[cursoId] = colegioId;
    }
  }
  if (
    typeof c.colegioId === 'string' &&
    c.colegioId &&
    typeof c.cursoId === 'string' &&
    c.cursoId
  ) {
    clases[c.cursoId] = c.colegioId;
  }
  return clases;
}

/**
 * Returns the user's Ceti claims, or null if the account has no role yet (a
 * fresh OAuth sign-in before an admin or a Function assigns one). `admin` is
 * global; `profesor` needs a colegioId; `estudiante` carries up to 5 classes
 * (none = uses Ceti on their own). Pass `forceRefresh` after a claims change
 * to bypass the cached token.
 */
export async function readCetiClaims(user: User, forceRefresh = false): Promise<CetiClaims | null> {
  try {
    const result = await getIdTokenResult(user, forceRefresh);
    const c = result.claims as Record<string, unknown>;
    if (!isRole(c.role)) return null;
    if (c.role === 'estudiante') return { role: 'estudiante', clases: clasesDeClaims(c) };
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
