import * as admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

admin.initializeApp();
const db = getFirestore();

const RATE_COLLECTION = 'rateLimits';

interface RateCfg {
  maxInWindow: number;
  windowMs: number;
}

const RATE_REDEEM: RateCfg = {
  maxInWindow: Number(process.env.RL_REDEEM_INVITE_MAX ?? 10),
  windowMs: Number(process.env.RL_REDEEM_INVITE_WINDOW_MS ?? 300_000),
};

async function consumeRateLimit(uid: string, cfg: RateCfg, bucket: string): Promise<void> {
  const ref = db.collection(RATE_COLLECTION).doc(`${uid}_${bucket}`);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { windowStart?: number; count?: number } | undefined;
    const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : now;
    let count = typeof data?.count === 'number' ? data.count : 0;
    if (now - windowStart > cfg.windowMs) {
      tx.set(ref, { windowStart: now, count: 1, updatedAt: FieldValue.serverTimestamp() });
      return;
    }
    if (count >= cfg.maxInWindow) {
      throw new HttpsError('resource-exhausted', 'Demasiados intentos. Espera unos minutos.');
    }
    tx.set(
      ref,
      { windowStart, count: count + 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });
}

function invitationExpiresAt(inv: DocumentData): Date | null {
  const e = inv.expiresAt;
  if (e instanceof Timestamp) return e.toDate();
  if (e && typeof (e as { toDate?: () => Date }).toDate === 'function') {
    return (e as { toDate: () => Date }).toDate();
  }
  return null;
}

export const redeemInvitation = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Inicia sesión.');
  }
  const childUid = request.auth.uid;
  const raw = request.data as { code?: string };
  const code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';
  if (!code || code.length < 6) {
    throw new HttpsError('invalid-argument', 'Código inválido.');
  }

  await consumeRateLimit(childUid, RATE_REDEEM, 'redeem_invite');

  const invRef = db.collection('invitations').doc(code);
  const childUserRef = db.collection('users').doc(childUid);

  let familyIdOut = '';
  let childNickname = '';

  await db.runTransaction(async (tx) => {
    const [invSnap, userSnap] = await Promise.all([tx.get(invRef), tx.get(childUserRef)]);

    if (!invSnap.exists) {
      throw new HttpsError('not-found', 'Código no válido.');
    }
    const inv = invSnap.data()!;
    if (inv.used === true) {
      throw new HttpsError('failed-precondition', 'Este código ya fue usado.');
    }
    const exp = invitationExpiresAt(inv);
    if (exp && exp.getTime() < Date.now()) {
      throw new HttpsError('failed-precondition', 'El código expiró.');
    }

    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'Completa tu perfil primero.');
    }
    const u = userSnap.data()!;
    if (u.role !== 'child') {
      throw new HttpsError('failed-precondition', 'Solo perfiles infantiles pueden enlazar.');
    }
    const existingFam = u.familyId;
    if (existingFam && String(existingFam).length > 0) {
      throw new HttpsError('failed-precondition', 'Ya estás enlazado a una familia.');
    }

    const familyId = String(inv.familyId || inv.parentUid || '');
    if (!familyId) {
      throw new HttpsError('failed-precondition', 'Invitación corrupta.');
    }

    const childProfile = (u.childProfile || {}) as Record<string, unknown>;
    childNickname = typeof childProfile.nickname === 'string' ? childProfile.nickname : 'Niño';

    const childDocRef = db
      .collection('families')
      .doc(familyId)
      .collection('children')
      .doc(childUid);
    tx.set(childDocRef, {
      id: childUid,
      nickname: childNickname,
      age: typeof childProfile.age === 'number' ? childProfile.age : 0,
      avatarEmoji: typeof childProfile.avatarEmoji === 'string' ? childProfile.avatarEmoji : '',
      updatedAt: Date.now(),
    });

    tx.update(invRef, { used: true, usedAt: FieldValue.serverTimestamp(), usedBy: childUid });
    tx.update(childUserRef, {
      familyId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    familyIdOut = familyId;
  });

  await admin.auth().setCustomUserClaims(childUid, { role: 'child', familyId: familyIdOut });

  return { familyId: familyIdOut, nickname: childNickname };
});

/** Sincroniza custom claims con users/{uid} (role + familyId). */
export const syncUserClaims = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Inicia sesión.');
  }
  const uid = request.auth.uid;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Perfil no encontrado.');
  }
  const u = snap.data()!;
  const role = u.role === 'parent' || u.role === 'child' ? u.role : 'child';
  let familyId: string | null = typeof u.familyId === 'string' ? u.familyId : null;
  if (role === 'parent') {
    familyId = uid;
  }
  await admin.auth().setCustomUserClaims(uid, { role, familyId: familyId || '' });
  return { role, familyId: familyId || '' };
});

/** Limpia invitaciones caducadas (batch). */
export const cleanupExpiredInvitations = onSchedule('every 24 hours', async () => {
  const now = Timestamp.now();
  const snap = await db
    .collection('invitations')
    .where('used', '==', false)
    .where('expiresAt', '<', now)
    .limit(400)
    .get();

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
});
