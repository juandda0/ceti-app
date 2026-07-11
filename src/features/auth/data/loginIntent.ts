/**
 * Login intent (D-ADMIN): whether the user declared themselves 'estudiante' or
 * 'profesor' in the role bottom sheet before signing in. The server still
 * decides the real role (resolveMyAccess); this intent only routes a user with
 * NO role: 'profesor' → "pending authorization" screen, 'estudiante' → join gate.
 * In-memory: a single sign-in intent, cleared on logout.
 */
export type LoginIntent = 'estudiante' | 'profesor';

let intent: LoginIntent | null = null;

export const loginIntent = {
  set: (value: LoginIntent): void => {
    intent = value;
  },
  /** Peek (non-destructive): the bootstrap re-runs on every auth change. */
  get: (): LoginIntent | null => intent,
  clear: (): void => {
    intent = null;
  },
};
