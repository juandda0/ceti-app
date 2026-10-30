/**
 * Fase 6 — biblioteca de mundos de la entidad (ver dominio/biblioteca.ts). Solo
 * estos callables escriben `colegios/{cid}/biblioteca/{id}`; la leen los profes
 * de la entidad. Hace falta la licencia de la entidad vigente.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import {
  MAX_BYTES_PUBLICACION,
  armarPublicacion,
  configConMundo,
  licenciaVigente,
  piezasDeMundo,
  piezasParaMundoNuevo,
  type ConfigMundosDoc,
  type EntradaMundo,
  type PublicacionBiblioteca,
} from './dominio';
import { leerEntidad, type EstadoEntidad } from './entidades';
import { exigirPermiso } from './permisos';

interface Contexto {
  db: Firestore;
  uid: string;
  colegioId: string;
  nombre: string;
  entidad: EstadoEntidad;
}

async function contexto(request: CallableRequest): Promise<Contexto> {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  const colegioId = caller.token.colegioId;
  if (caller.token.role !== 'profesor' || typeof colegioId !== 'string' || !colegioId) {
    throw new HttpsError('permission-denied', 'Solo para profes de una entidad.');
  }
  const db = getFirestore();
  const entidad = await leerEntidad(db, colegioId);
  if (!entidad.entidad || !entidad.profes.some((p) => p.uid === caller.uid)) {
    throw new HttpsError('failed-precondition', 'La biblioteca es de las entidades.', { codigo: 'sin_entidad' });
  }
  if (!licenciaVigente(entidad.licencia, Date.now())) {
    throw new HttpsError('failed-precondition', 'La biblioteca viene con el plan de la entidad.', { codigo: 'requiere_plan' });
  }
  const nombre = entidad.profes.find((p) => p.uid === caller.uid)?.nombre ?? 'Profe';
  return { db, uid: caller.uid, colegioId, nombre, entidad };
}

async function cursoDelProfe(c: Contexto, cursoId: unknown) {
  if (typeof cursoId !== 'string' || !cursoId || cursoId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Falta la clase.');
  }
  const ref = c.db.doc(`colegios/${c.colegioId}/cursos/${cursoId}`);
  const snap = await ref.get();
  // F9: publicar o copiar un mundo cambia contenido: solo quien edita la clase.
  exigirPermiso(snap, c.uid, 'publicar');
  return { ref, snap };
}

/** Publica en la biblioteca una copia de un mundo propio de una clase del profe. */
export const publicarEnBiblioteca = onCall(async (request) => {
  const c = await contexto(request);
  const worldId = request.data?.worldId;
  if (typeof worldId !== 'string' || !worldId.startsWith('cw_')) {
    throw new HttpsError('invalid-argument', 'Solo se publican mundos propios.');
  }
  const { ref, snap } = await cursoDelProfe(c, request.data?.cursoId);
  const [config, contenido] = await Promise.all([ref.collection('config').doc('mundos').get(), ref.collection('contenido').get()]);
  const entrada = ((config.get('mundos') ?? []) as EntradaMundo[]).find((m) => m.worldId === worldId);
  if (!entrada) throw new HttpsError('not-found', 'Ese mundo no está en la clase.');
  const piezas = piezasDeMundo(
    contenido.docs.map((d) => ({ id: d.id, data: d.data() })),
    worldId
  );
  if (piezas.length === 0) throw new HttpsError('failed-precondition', 'El mundo todavía no tiene contenido.');
  const overrides = (config.get('overrides') as Record<string, Record<string, boolean>> | undefined)?.[worldId];
  const pub = armarPublicacion({
    entrada,
    piezas,
    overrides,
    grado: typeof snap.get('grado') === 'string' ? snap.get('grado') : null,
    cursoId: snap.id,
    autorUid: c.uid,
    autorNombre: c.nombre,
    ahora: Date.now(),
  });
  if (Buffer.byteLength(JSON.stringify(pub)) > MAX_BYTES_PUBLICACION) {
    throw new HttpsError('failed-precondition', 'El mundo es muy grande para la biblioteca.', { codigo: 'muy_grande' });
  }
  // Volver a publicar el mismo mundo reemplaza la copia anterior.
  const id = `${snap.id}_${worldId}`;
  const destino = c.db.doc(`colegios/${c.colegioId}/biblioteca/${id}`);
  const previa = await destino.get();
  await destino.set({ ...pub, usos: previa.exists ? (previa.get('usos') ?? 0) : 0 });
  return { ok: true, id };
});

/** Copia un mundo de la biblioteca a una clase del profe, como borrador. */
export const usarDeBiblioteca = onCall(async (request) => {
  const c = await contexto(request);
  const id = request.data?.id;
  if (typeof id !== 'string' || !id || id.includes('/')) throw new HttpsError('invalid-argument', 'Falta el mundo.');
  const { ref } = await cursoDelProfe(c, request.data?.cursoId);
  const pubRef = c.db.doc(`colegios/${c.colegioId}/biblioteca/${id}`);
  const pubSnap = await pubRef.get();
  if (!pubSnap.exists) throw new HttpsError('not-found', 'Ese mundo ya no está en la biblioteca.');
  const pub = pubSnap.data() as PublicacionBiblioteca;
  const nuevo = `cw_${randomBytes(6).toString('hex')}`;
  const configRef = ref.collection('config').doc('mundos');
  await c.db.runTransaction(async (tx) => {
    const config = await tx.get(configRef);
    const siguiente = configConMundo(
      config.exists ? (config.data() as Partial<ConfigMundosDoc>) : null,
      pub,
      nuevo,
      c.uid,
      Date.now()
    );
    if (!siguiente) {
      throw new HttpsError('resource-exhausted', 'La clase ya tiene 30 mundos.', { codigo: 'clase_llena' });
    }
    for (const p of piezasParaMundoNuevo(pub, nuevo)) tx.set(ref.collection('contenido').doc(p.id), p.data);
    tx.set(configRef, siguiente);
    tx.update(pubRef, { usos: FieldValue.increment(1) });
  });
  return { ok: true, worldId: nuevo };
});

/** El autor o un admin retiran un mundo de la biblioteca (las copias ya hechas se quedan). */
export const retirarDeBiblioteca = onCall(async (request) => {
  const c = await contexto(request);
  const id = request.data?.id;
  if (typeof id !== 'string' || !id || id.includes('/')) throw new HttpsError('invalid-argument', 'Falta el mundo.');
  const ref = c.db.doc(`colegios/${c.colegioId}/biblioteca/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  const esAdmin = c.entidad.profes.find((p) => p.uid === c.uid)?.rol === 'admin';
  if (snap.get('autorUid') !== c.uid && !esAdmin) {
    throw new HttpsError('permission-denied', 'Solo quien lo publicó o un admin.');
  }
  await ref.delete();
  return { ok: true };
});
