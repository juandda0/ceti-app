import { getDocs, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { leaderboardCollectionRef, leaderboardDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { LeaderboardEntry } from '@shared/types/tenancy';

/**
 * Class leaderboard (V2). A student maintains their OWN minimal entry; course
 * mates read the board only when colaboracionAula is on (firestore.rules). XP is
 * student-reported for gamification — the teacher dashboard uses real progress as
 * the source of truth, so this never affects compliance reporting.
 */
export const leaderboardRepository = {
  async upsertEntry(
    colegioId: string,
    cursoId: string,
    uid: string,
    data: { displayLabel: string; xp: number }
  ): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = leaderboardDocRef(clients.firestore, colegioId, cursoId, uid);
    await setDoc(
      ref,
      stripUndefinedValues({
        uid,
        displayLabel: data.displayLabel,
        xp: data.xp,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
    return true;
  },

  /** All entries for a course, ranked by XP descending. */
  async getCourseLeaderboard(colegioId: string, cursoId: string): Promise<LeaderboardEntry[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(leaderboardCollectionRef(clients.firestore, colegioId, cursoId));
    return snap.docs.map((d) => d.data() as LeaderboardEntry).sort((a, b) => b.xp - a.xp);
  },
};
