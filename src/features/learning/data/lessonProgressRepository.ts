import { setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { userLessonProgressDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';

export type RemoteLessonProgress = {
  uid: string;
  lessonId: string;
  completedAt: number;
  quizScore: number;
  perfectQuiz: boolean;
};

export const lessonProgressRepository = {
  async upsertLessonProgress(uid: string, progress: RemoteLessonProgress): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = userLessonProgressDocRef(clients.firestore, uid, progress.lessonId);
    await setDoc(ref, stripUndefinedValues({ ...progress } as Record<string, unknown>), {
      merge: true,
    });
    return true;
  },
};
