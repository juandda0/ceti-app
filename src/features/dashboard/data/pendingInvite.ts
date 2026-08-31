/**
 * Holds a class-invite code across the login/onboarding hops (D-ADMIN, RQ-FN13).
 * The /join/{codigo} route stashes the code and bounces to the resolver; once
 * the student is authenticated + onboarded, onboarding consumes it and joins.
 * In-memory only — an invite is a single navigation intent, not persistent state.
 */
let pending: string | null = null;

export const pendingInvite = {
  set: (code: string): void => {
    pending = code.trim().toUpperCase() || null;
  },
  consume: (): string | null => {
    const c = pending;
    pending = null;
    return c;
  },
};
