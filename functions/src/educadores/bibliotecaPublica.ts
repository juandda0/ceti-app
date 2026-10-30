/**
 * Fase 8c — biblioteca pública de mundos (ver dominio/bibliotecaPublica.ts).
 * Solo estos callables escriben `bibliotecaPublica/{id}`; la ficha la leen los
 * profes (las reglas esconden las ocultas) y las piezas solo el servidor.
 *
 * - `publicarEnBibliotecaPublica`: un mundo propio (`cw_*`) de una clase del
 *   profe, con plan `bibliotecaPublicar`. Volver a publicar lo actualiza.
 * - `usarDeBibliotecaPublica`: lo copia a una clase del profe como mundo nuevo
 *   en borrador (`mundosPropios`, Piloto o más).
 * - `reportarPublicacion`: un reporte por profe; con 3 se oculta.
 * - `retirarDeBibliotecaPublica`: el autor o un admin de Ceti.
 * - `moderarBibliotecaPublica` (F9): el admin de Ceti lista los ocultos con sus
 *   reportes y vuelve a mostrar uno (limpia los reportes). Retirar es
 *   `retirarDeBibliotecaPublica`. Los mundos ya copiados a clases no se tocan.
 */
import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  MAX_BYTES_PUBLICACION,
  MAX_MOTIVO_REPORTE,
  armarPublicacion,
  conReporte,
  configConMundo,
  fichaPublica,
  piezasDeMundo,
  piezasParaMundoNuevo,
  puede,
  type ConfigMundosDoc,
  type EntradaMundo,
  type FichaPublica,
  type OcultoModeracion,
  type Funcion,
  type PublicacionBiblioteca,
} from './dominio';
import { planDeProfe } from './plan';
import { exigirPermiso } from './permisos';

function profe(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const cid = auth.token.colegioId;
  if (auth.token.role !== 'profesor' || typeof cid !== 'string' || !cid) {
    throw new HttpsError('permission-denied', 'Solo para profes.');
  }
  return { uid: auth.uid, cid, nombre: typeof auth.token.name === 'string' && auth.token.name ? auth.token.name : 'Profe' };
}

async function exigir(db: Firestore, uid: string, cid: string, funcion: Funcion, mensaje: string) {
  const plan = await planDeProfe(uid, cid, Date.now(), db);
  if (!puede(plan, funcion)) throw new HttpsError('failed-precondition', mensaje, { codigo: 'requiere_plan', funcion, plan });
}

async function cursoDelProfe(db: Firestore, cid: string, cursoId: unknown, uid: string) {
  if (typeof cursoId !== 'string' || !cursoId || cursoId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Falta la clase.');
  }
  const ref = db.doc(`colegios/${cid}/cursos/${cursoId}`);
  const snap = await ref.get();
  // F9: publicar o copiar un mundo cambia contenido: solo quien edita la clase.
  exigirPermiso(snap, uid, 'publicar');
  return { ref, snap };
}

const idValido = (id: unknown): id is string => typeof id === 'string' && !!id && !id.includes('/') && id.length <= 200;

export const publicarEnBibliotecaPublica = onCall(async (request) => {
  const p = profe(request.auth);
  const db = getFirestore();
  const worldId = request.data?.worldId;
  if (typeof worldId !== 'string' || !worldId.startsWith('cw_')) {
    throw new HttpsError('invalid-argument', 'Solo se publican mundos propios.');
  }
  await exigir(db, p.uid, p.cid, 'bibliotecaPublicar', 'Publicar en la biblioteca pública viene con Comandante o con el plan de tu institución.');
  const { ref, snap } = await cursoDelProfe(db, p.cid, request.data?.cursoId, p.uid);
  const [config, contenido, colegio] = await Promise.all([
    ref.collection('config').doc('mundos').get(),
    ref.collection('contenido').get(),
    db.doc(`colegios/${p.cid}`).get(),
  ]);
  const entrada = ((config.get('mundos') ?? []) as EntradaMundo[]).find((m) => m.worldId === worldId);
  if (!entrada) throw new HttpsError('not-found', 'Ese mundo no está en la clase.');
  const piezas = piezasDeMundo(
    contenido.docs.map((d) => ({ id: d.id, data: d.data() })),
    worldId
  );
  if (piezas.length === 0) throw new HttpsError('failed-precondition', 'El mundo todavía no tiene contenido.');
  const pub = armarPublicacion({
    entrada,
    piezas,
    overrides: (config.get('overrides') as Record<string, Record<string, boolean>> | undefined)?.[worldId],
    grado: typeof snap.get('grado') === 'string' ? snap.get('grado') : null,
    cursoId: snap.id,
    autorUid: p.uid,
    autorNombre: p.nombre,
    ahora: Date.now(),
  });
  if (Buffer.byteLength(JSON.stringify(pub)) > MAX_BYTES_PUBLICACION) {
    throw new HttpsError('failed-precondition', 'El mundo es muy grande para la biblioteca.', { codigo: 'muy_grande' });
  }
  const institucion =
    request.data?.mostrarInstitucion === true
      ? ((colegio.get('entidad.nombre') as string | undefined) || (colegio.get('nombre') as string | undefined) || null)
      : null;
  const id = `${p.cid}_${snap.id}_${worldId}`;
  const destino = db.doc(`bibliotecaPublica/${id}`);
  const previa = await destino.get();
  const ficha = fichaPublica(pub, { institucion, colegioId: p.cid, previa: previa.exists ? (previa.data() as FichaPublica) : null });
  const batch = db.batch();
  batch.set(destino, ficha);
  batch.set(destino.collection('contenido').doc('piezas'), { piezas: pub.piezas });
  await batch.commit();
  return { ok: true, id };
});

export const usarDeBibliotecaPublica = onCall(async (request) => {
  const p = profe(request.auth);
  const db = getFirestore();
  const id = request.data?.id;
  if (!idValido(id)) throw new HttpsError('invalid-argument', 'Falta el mundo.');
  await exigir(db, p.uid, p.cid, 'mundosPropios', 'Copiar mundos a tu clase viene con el plan Piloto.');
  const { ref } = await cursoDelProfe(db, p.cid, request.data?.cursoId, p.uid);
  const fichaRef = db.doc(`bibliotecaPublica/${id}`);
  const [fichaSnap, piezasSnap] = await Promise.all([fichaRef.get(), fichaRef.collection('contenido').doc('piezas').get()]);
  if (!fichaSnap.exists || !piezasSnap.exists) throw new HttpsError('not-found', 'Ese mundo ya no está en la biblioteca.');
  const ficha = fichaSnap.data() as FichaPublica;
  if (ficha.oculto) throw new HttpsError('failed-precondition', 'Ese mundo está en revisión.');
  const pub: PublicacionBiblioteca = { ...ficha, piezas: (piezasSnap.get('piezas') ?? {}) as PublicacionBiblioteca['piezas'] };
  const nuevo = `cw_${randomBytes(6).toString('hex')}`;
  const configRef = ref.collection('config').doc('mundos');
  await db.runTransaction(async (tx) => {
    const config = await tx.get(configRef);
    const siguiente = configConMundo(config.exists ? (config.data() as Partial<ConfigMundosDoc>) : null, pub, nuevo, p.uid, Date.now());
    if (!siguiente) throw new HttpsError('resource-exhausted', 'La clase ya tiene 30 mundos.', { codigo: 'clase_llena' });
    for (const pieza of piezasParaMundoNuevo(pub, nuevo)) tx.set(ref.collection('contenido').doc(pieza.id), pieza.data);
    tx.set(configRef, siguiente);
    tx.update(fichaRef, { usos: FieldValue.increment(1) });
  });
  return { ok: true, worldId: nuevo };
});

export const reportarPublicacion = onCall(async (request) => {
  const p = profe(request.auth);
  const id = request.data?.id;
  if (!idValido(id)) throw new HttpsError('invalid-argument', 'Falta el mundo.');
  const motivo = typeof request.data?.motivo === 'string' ? request.data.motivo.trim().slice(0, MAX_MOTIVO_REPORTE) : '';
  const db = getFirestore();
  const ref = db.doc(`bibliotecaPublica/${id}`);
  const oculto = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'Ese mundo ya no está en la biblioteca.');
    const r = conReporte(s.data() as FichaPublica, p.uid);
    if (!r) return s.get('oculto') === true;
    tx.update(ref, r);
    tx.set(ref.collection('reportes').doc(p.uid), { motivo: motivo || null, reportadoAt: Date.now() });
    return r.oculto;
  });
  return { ok: true, oculto };
});

export const retirarDeBibliotecaPublica = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const id = request.data?.id;
  if (!idValido(id)) throw new HttpsError('invalid-argument', 'Falta el mundo.');
  const db = getFirestore();
  const ref = db.doc(`bibliotecaPublica/${id}`);
  const s = await ref.get();
  if (!s.exists) return { ok: true };
  if (s.get('autorUid') !== auth.uid && auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo quien lo publicó o Ceti.');
  }
  await db.recursiveDelete(ref);
  return { ok: true };
});

export const moderarBibliotecaPublica = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (auth.token.role !== 'admin') throw new HttpsError('permission-denied', 'Solo el equipo de Ceti modera la biblioteca.');
  const db = getFirestore();
  const accion = request.data?.accion;
  if (accion === 'listar') {
    const ocultos = await db.collection('bibliotecaPublica').where('oculto', '==', true).limit(100).get();
    const lista: OcultoModeracion[] = await Promise.all(
      ocultos.docs.map(async (d) => {
        const reportes = await d.ref.collection('reportes').get();
        return {
          id: d.id,
          titulo: String(d.get('titulo') ?? ''),
          autorNombre: String(d.get('autorNombre') ?? ''),
          institucion: typeof d.get('institucion') === 'string' ? (d.get('institucion') as string) : null,
          usos: Number(d.get('usos') ?? 0),
          publicadoAt: Number(d.get('publicadoAt') ?? 0),
          reportes: reportes.docs
            .map((r) => ({ motivo: (r.get('motivo') as string | null) ?? null, reportadoAt: Number(r.get('reportadoAt') ?? 0) }))
            .sort((a, b) => b.reportadoAt - a.reportadoAt),
        };
      })
    );
    return { ok: true, ocultos: lista.sort((a, b) => b.reportes.length - a.reportes.length) };
  }
  if (accion === 'mostrar') {
    const id = request.data?.id;
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Falta el mundo.');
    const ref = db.doc(`bibliotecaPublica/${id}`);
    const s = await ref.get();
    if (!s.exists) throw new HttpsError('not-found', 'Ese mundo ya no está en la biblioteca.');
    const reportes = await ref.collection('reportes').get();
    const lote = db.batch();
    reportes.docs.forEach((r) => lote.delete(r.ref));
    lote.update(ref, { oculto: false, reportes: [], revisadoAt: Date.now(), revisadoPor: auth.uid });
    await lote.commit();
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Acción inválida.');
});
