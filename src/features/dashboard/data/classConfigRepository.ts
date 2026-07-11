import { deleteDoc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { cursoConfigMundosDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { CursoConfigMundos } from '@shared/types/tenancy';

/**
 * Class configuration (D-ORQ, RQ-PR10): written only by the course's profesor
 * (firestore.rules); students subscribe live. `null` everywhere means "no
 * config" → callers resolve to defaults (see classConfig.ts), so offline/demo
 * degrade to the pre-D-ORQ behavior.
 */
export const classConfigRepository = {
  async get(colegioId: string, cursoId: string): Promise<CursoConfigMundos | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(cursoConfigMundosDocRef(clients.firestore, colegioId, cursoId));
    return snap.exists() ? (snap.data() as CursoConfigMundos) : null;
  },

  /**
   * Live subscription (the student's realtime channel). Errors (offline,
   * permission) resolve to `null` → defaults; never throws into the UI.
   */
  subscribe(
    colegioId: string,
    cursoId: string,
    onConfig: (config: CursoConfigMundos | null) => void
  ): () => void {
    const clients = getFirebaseClients();
    if (!clients?.firestore) {
      onConfig(null);
      return () => {};
    }
    return onSnapshot(
      cursoConfigMundosDocRef(clients.firestore, colegioId, cursoId),
      (snap) => onConfig(snap.exists() ? (snap.data() as CursoConfigMundos) : null),
      () => onConfig(null)
    );
  },

  async upsert(colegioId: string, cursoId: string, config: CursoConfigMundos): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await setDoc(
      cursoConfigMundosDocRef(clients.firestore, colegioId, cursoId),
      stripUndefinedValues({ ...config } as Record<string, unknown>),
      { merge: false }
    );
    return true;
  },

  /** "Restaurar configuración": deleting the doc restores the defaults. */
  async reset(colegioId: string, cursoId: string): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await deleteDoc(cursoConfigMundosDocRef(clients.firestore, colegioId, cursoId));
    return true;
  },
};
