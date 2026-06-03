import { collection, doc, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export const FIRESTORE_COLLECTIONS = {
  users: 'users',
  goals: 'goals',
  deposits: 'deposits',
  lessonProgress: 'lessonProgress',
  wallet: 'wallet',
  questionBank: 'questionBank',
  aiProfile: 'aiProfile',
} as const;

export const WALLET_STATE_DOC_ID = 'state';

export function userDocPath(uid: string): string {
  return `${FIRESTORE_COLLECTIONS.users}/${uid}`;
}

export function userDocRef(db: import('firebase/firestore').Firestore, uid: string) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid);
}

export function userGoalsCollectionRef(db: import('firebase/firestore').Firestore, uid: string) {
  return collection(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.goals);
}

export function userGoalDocRef(
  db: import('firebase/firestore').Firestore,
  uid: string,
  goalId: string
) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.goals, goalId);
}

export function userDepositsCollectionRef(db: import('firebase/firestore').Firestore, uid: string) {
  return collection(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.deposits);
}

export function userDepositDocRef(
  db: import('firebase/firestore').Firestore,
  uid: string,
  depositId: string
) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.deposits, depositId);
}

export function userLessonProgressCollectionRef(
  db: import('firebase/firestore').Firestore,
  uid: string
) {
  return collection(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.lessonProgress);
}

export function userLessonProgressDocRef(
  db: import('firebase/firestore').Firestore,
  uid: string,
  lessonId: string
) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.lessonProgress, lessonId);
}

export function userWalletDocRef(db: Firestore, uid: string) {
  return doc(
    db,
    FIRESTORE_COLLECTIONS.users,
    uid,
    FIRESTORE_COLLECTIONS.wallet,
    WALLET_STATE_DOC_ID
  );
}

export function userAiProfileDocRef(db: Firestore, uid: string) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.aiProfile, 'state');
}

export function questionBankByWorldQuery(db: Firestore, worldId: string) {
  return query(collection(db, FIRESTORE_COLLECTIONS.questionBank), where('worldId', '==', worldId));
}
