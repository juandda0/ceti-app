import { doc } from 'firebase/firestore';

/**
 * Esquema lógico Firestore: familias y hijos (reglas reales en /firestore.rules).
 */
export const FIRESTORE_COLLECTIONS = {
  families: 'families',
  children: 'children',
  users: 'users',
  invitations: 'invitations',
  rateLimits: 'rateLimits',
  goals: 'goals',
  deposits: 'deposits',
  lessonProgress: 'lessonProgress',
  wallet: 'wallet',
} as const;

export function familyDocPath(familyId: string): string {
  return `${FIRESTORE_COLLECTIONS.families}/${familyId}`;
}

export function userDocPath(uid: string): string {
  return `${FIRESTORE_COLLECTIONS.users}/${uid}`;
}

export function invitationDocPath(code: string): string {
  return `${FIRESTORE_COLLECTIONS.invitations}/${code}`;
}

export function childDocRef(
  db: import('firebase/firestore').Firestore,
  familyId: string,
  childId: string
) {
  return doc(db, FIRESTORE_COLLECTIONS.families, familyId, FIRESTORE_COLLECTIONS.children, childId);
}
