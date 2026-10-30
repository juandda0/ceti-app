/**
 * Fase 8b — certificados de participación (ver dominio/certificados.ts).
 *
 * - `emitirCertificados` (profe de la clase, plan con `certificados`): a cada
 *   estudiante activo que conquistó los mundos elegidos le deja un certificado
 *   con código público. No repite uno vigente con los mismos mundos.
 * - `verCertificado` (sin cuenta): lo que muestra `/certificado/{código}`.
 * - `revocarCertificado` (profe de la clase): lo marca como revocado; la
 *   verificación lo dice.
 */
import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  MAX_CERTIFICADOS_POR_VEZ,
  MAX_MUNDOS_CERTIFICADO,
  codigoCertificado,
  desempenosTrabajados,
  esCodigoCertificado,
  faltantes,
  publicoDe,
  puede,
  type CertificadoGuardado,
  type CertificadoPublico,
} from './dominio';
import { planDeProfe } from './plan';

function profeConColegio(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const cid = auth.token.colegioId;
  if (auth.token.role !== 'profesor' || typeof cid !== 'string' || !cid) {
    throw new HttpsError('permission-denied', 'Solo para profes.');
  }
  return { uid: auth.uid, cid, nombre: typeof auth.token.name === 'string' && auth.token.name ? auth.token.name : 'Tu profe' };
}

async function cursoDelProfe(db: Firestore, cid: string, cursoId: unknown, uid: string) {
  if (typeof cursoId !== 'string' || !cursoId || cursoId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Falta la clase.');
  }
  const snap = await db.doc(`colegios/${cid}/cursos/${cursoId}`).get();
  if (!snap.exists || !((snap.get('profesorUids') ?? []) as string[]).includes(uid)) {
    throw new HttpsError('permission-denied', 'No es tu clase.');
  }
  return snap;
}

async function codigoLibre(db: Firestore): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const c = codigoCertificado(randomBytes(8));
    if (!(await db.doc(`certificados/${c}`).get()).exists) return c;
  }
  throw new HttpsError('internal', 'No se pudo generar un código.');
}

export const emitirCertificados = onCall(async (request) => {
  const profe = profeConColegio(request.auth);
  const db = getFirestore();
  const curso = await cursoDelProfe(db, profe.cid, request.data?.cursoId, profe.uid);
  const plan = await planDeProfe(profe.uid, profe.cid, Date.now(), db);
  if (!puede(plan, 'certificados')) {
    throw new HttpsError('failed-precondition', 'Los certificados vienen con el plan Piloto.', {
      codigo: 'requiere_plan',
      funcion: 'certificados',
      plan,
    });
  }
  const uids = Array.isArray(request.data?.uids) ? [...new Set(request.data.uids as unknown[])].filter((u): u is string => typeof u === 'string' && !!u && !u.includes('/')) : [];
  const mundos = Array.isArray(request.data?.mundos) ? [...new Set(request.data.mundos as unknown[])].filter((w): w is string => typeof w === 'string' && !!w) : [];
  const nombres = (request.data?.nombresMundos ?? {}) as Record<string, unknown>;
  if (uids.length === 0 || uids.length > MAX_CERTIFICADOS_POR_VEZ) throw new HttpsError('invalid-argument', 'Elige de 1 a 60 estudiantes.');
  if (mundos.length === 0 || mundos.length > MAX_MUNDOS_CERTIFICADO) throw new HttpsError('invalid-argument', 'Elige de 1 a 12 mundos.');
  const nombresMundos = mundos.map((w) => (typeof nombres[w] === 'string' && nombres[w] ? String(nombres[w]).slice(0, 80) : w));
  const claveMundos = [...mundos].sort().join(',');

  const cursoPath = curso.ref.path;
  const colegio = await db.doc(`colegios/${profe.cid}`).get();
  const institucion = (colegio.get('entidad.nombre') as string | undefined) || (colegio.get('nombre') as string | undefined) || 'Ceti';
  const tipoEntidad = (colegio.get('entidad.tipo') as string | undefined) ?? null;
  const ahora = Date.now();

  const emitidos: { uid: string; codigo: string }[] = [];
  const omitidos: { uid: string; motivo: 'no_activo' | 'faltan_mundos' | 'ya_tiene'; faltan?: string[]; codigo?: string }[] = [];
  for (const uid of uids) {
    const est = db.doc(`${cursoPath}/estudiantes/${uid}`);
    const [roster, progreso, resumen, previos] = await Promise.all([
      est.get(),
      est.collection('progress').get(),
      est.collection('resumen').doc('clase').get(),
      est.collection('certificados').where('claveMundos', '==', claveMundos).get(),
    ]);
    if (!roster.exists || roster.get('estado') !== 'activo') {
      omitidos.push({ uid, motivo: 'no_activo' });
      continue;
    }
    const conquistados = new Set(progreso.docs.filter((d) => d.get('completed') === true).map((d) => d.id));
    const faltan = faltantes(conquistados, mundos);
    if (faltan.length) {
      omitidos.push({ uid, motivo: 'faltan_mundos', faltan });
      continue;
    }
    const vigente = previos.docs.find((d) => !d.get('revocadoAt'));
    if (vigente) {
      omitidos.push({ uid, motivo: 'ya_tiene', codigo: vigente.id });
      continue;
    }
    const codigo = await codigoLibre(db);
    const joinedAt = roster.get('joinedAt');
    const cert: CertificadoGuardado = {
      codigo,
      nombre: (roster.get('nombre') as string) || 'Estudiante',
      clase: (curso.get('nombre') as string) || '',
      institucion,
      tipoEntidad,
      mundos: nombresMundos,
      desempenos: desempenosTrabajados(resumen.get('porDesempeno')),
      desde: typeof joinedAt === 'number' ? joinedAt : ahora,
      hasta: ahora,
      profe: profe.nombre,
      emitidoAt: ahora,
      revocadoAt: null,
      colegioId: profe.cid,
      cursoId: curso.id,
      uid,
      emitidoPor: profe.uid,
    };
    const batch = db.batch();
    batch.set(db.doc(`certificados/${codigo}`), cert);
    batch.set(est.collection('certificados').doc(codigo), { ...publicoDe(cert), claveMundos });
    await batch.commit();
    emitidos.push({ uid, codigo });
  }
  return { emitidos, omitidos };
});

/** Sin cuenta: verifica un código. */
export const verCertificado = onCall(async (request): Promise<CertificadoPublico> => {
  const codigo = typeof request.data?.codigo === 'string' ? request.data.codigo.trim().toUpperCase() : '';
  if (!esCodigoCertificado(codigo)) throw new HttpsError('invalid-argument', 'Ese código no tiene la forma CETI-XXXX-XXXX.');
  const s = await getFirestore().doc(`certificados/${codigo}`).get();
  if (!s.exists) throw new HttpsError('not-found', 'No hay ningún certificado con ese código.');
  return publicoDe(s.data() as CertificadoGuardado);
});

export const revocarCertificado = onCall(async (request) => {
  const profe = profeConColegio(request.auth);
  const db = getFirestore();
  const curso = await cursoDelProfe(db, profe.cid, request.data?.cursoId, profe.uid);
  const codigo = request.data?.codigo;
  if (!esCodigoCertificado(codigo)) throw new HttpsError('invalid-argument', 'Código inválido.');
  const ref = db.doc(`certificados/${codigo}`);
  const s = await ref.get();
  if (!s.exists || s.get('cursoId') !== curso.id || s.get('colegioId') !== profe.cid) {
    throw new HttpsError('not-found', 'Ese certificado no es de esta clase.');
  }
  const ahora = Date.now();
  await Promise.all([
    ref.update({ revocadoAt: ahora }),
    db.doc(`${curso.ref.path}/estudiantes/${s.get('uid')}/certificados/${codigo}`).set({ revocadoAt: ahora }, { merge: true }),
  ]);
  return { ok: true };
});

/** Supresión Ley 1581: los certificados de un estudiante en una clase, con su verificación pública. */
export async function borrarCertificados(db: Firestore, colegioId: string, cursoId: string, uid: string): Promise<void> {
  const suyos = db.collection(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${uid}/certificados`);
  const s = await suyos.get();
  await Promise.all(s.docs.filter((d) => esCodigoCertificado(d.id)).map((d) => db.doc(`certificados/${d.id}`).delete()));
  await db.recursiveDelete(suyos);
}
