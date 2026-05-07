import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { FIRESTORE_COLLECTIONS } from '@shared/lib/firebase/paths';

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export const invitationService = {
  /**
   * Crea `invitations/{code}` (canje solo vía Cloud Function).
   */
  async generateChildLinkCode(familyId: string, parentUid: string): Promise<string> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) throw new Error('Firebase no configurado');
    const prefix = 'CETI';
    let code = '';
    let attempts = 0;
    while (attempts < 8) {
      code = `${prefix}-${randomSuffix()}`;
      const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.invitations, code);
      try {
        await setDoc(ref, {
          code,
          familyId,
          parentUid,
          used: false,
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        return code;
      } catch {
        attempts += 1;
      }
    }
    throw new Error('No se pudo generar un código único');
  },
};
