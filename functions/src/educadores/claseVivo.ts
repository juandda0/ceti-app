/**
 * Fase 8a — clase en vivo (ver dominio/claseVivo.ts). Un solo callable,
 * `operarClaseVivo`, con la acción: crear, siguiente, revelar, terminar o
 * cerrar. Cualquier profe de `profesorUids` la opera (co-docentes). Cadete
 * abre 3 al mes (contador `clasesVivo` en `suscripciones/{uid}/uso/{mes}`).
 *
 * Al terminar deja un intento `tipo: 'vivo'` por estudiante activo, con el
 * desempeño `d` de cada respuesta (onIntentoClase lo suma en resumen/clase), y
 * un resumen sin nombres en `cursos/{k}/sesionesVivo/{id}`.
 */
import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  FACTOR_MAS_TIEMPO,
  MENSAJES_ERROR_VIVO,
  abrirSiguiente,
  crearSesion,
  intentosDeSesion,
  limites,
  resumenSesion,
  revelarPregunta,
  terminarSesion,
  validarPreguntasVivo,
  type ClaveVivo,
  type ErrorVivo,
  type GrupoClase,
  type SesionVivo,
} from './dominio';
import { mesBogota, planDeProfe } from './plan';
import { refUsoIa } from './limites';

const ACCIONES = ['crear', 'siguiente', 'revelar', 'terminar', 'cerrar'] as const;
type Accion = (typeof ACCIONES)[number];

export const rutaVivo = (cid: string, k: string) => `colegios/${cid}/cursos/${k}/vivo/actual`;

function fallar(error: ErrorVivo): never {
  throw new HttpsError('failed-precondition', MENSAJES_ERROR_VIVO[error], { codigo: error });
}

/** Clases en vivo que el profe abrió este mes (Bogotá). */
export async function clasesVivoDelMes(db: Firestore, uid: string, ahora = Date.now()): Promise<number> {
  const s = await refUsoIa(uid, ahora, db).get();
  const n = s.get('clasesVivo');
  return typeof n === 'number' ? n : 0;
}

/** Nombres de los estudiantes activos de la clase (solo ellos juegan y quedan registrados). */
async function activosDe(db: Firestore, cursoPath: string): Promise<Record<string, string>> {
  const s = await db.collection(`${cursoPath}/estudiantes`).where('estado', '==', 'activo').get();
  return Object.fromEntries(
    s.docs.map((d) => [d.id, typeof d.get('nombre') === 'string' && d.get('nombre') ? (d.get('nombre') as string) : 'Estudiante'])
  );
}

export async function gruposDe(db: Firestore, cursoPath: string): Promise<GrupoClase[]> {
  const s = await db.doc(`${cursoPath}/config/grupos`).get();
  const lista = s.get('grupos');
  return Array.isArray(lista) ? (lista as GrupoClase[]).filter((g) => g && Array.isArray(g.uids)) : [];
}

/** Factor de tiempo de quien tiene la adaptación «más tiempo». */
async function factoresDe(db: Firestore, cursoPath: string, uids: readonly string[]): Promise<Record<string, number>> {
  if (uids.length === 0) return {};
  const refs = uids.map((u) => db.doc(`${cursoPath}/estudiantes/${u}/adaptaciones/actual`));
  const snaps = await db.getAll(...refs);
  const out: Record<string, number> = {};
  snaps.forEach((s, i) => {
    if (s.exists && s.get('masTiempo') === true) out[uids[i]] = FACTOR_MAS_TIEMPO;
  });
  return out;
}

export const operarClaseVivo = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const cid = auth.token.colegioId;
  if (auth.token.role !== 'profesor' || typeof cid !== 'string' || !cid) {
    throw new HttpsError('permission-denied', 'Solo para profes.');
  }
  const { cursoId, accion } = (request.data ?? {}) as Record<string, unknown>;
  if (typeof cursoId !== 'string' || !cursoId || cursoId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Falta la clase.');
  }
  if (!(ACCIONES as readonly unknown[]).includes(accion)) throw new HttpsError('invalid-argument', 'Acción inválida.');
  const db = getFirestore();
  const cursoPath = `colegios/${cid}/cursos/${cursoId}`;
  const curso = await db.doc(cursoPath).get();
  if (!curso.exists || !((curso.get('profesorUids') ?? []) as string[]).includes(auth.uid)) {
    throw new HttpsError('permission-denied', 'No es tu clase.');
  }
  const ref = db.doc(rutaVivo(cid, cursoId));
  const refClave = ref.collection('privado').doc('clave');
  const ahora = Date.now();

  switch (accion as Accion) {
    case 'crear': {
      const plan = await planDeProfe(auth.uid, cid, ahora, db);
      const tope = limites(plan).clasesVivoMes;
      const usadas = await clasesVivoDelMes(db, auth.uid, ahora);
      if (usadas >= tope) {
        throw new HttpsError('resource-exhausted', `Tu plan incluye ${tope} clases en vivo al mes. Pasa a Piloto para abrir más.`, {
          codigo: 'limite_vivo',
          plan,
          limite: tope,
        });
      }
      const preguntas = validarPreguntasVivo(request.data?.preguntas);
      const worldId = typeof request.data?.worldId === 'string' ? request.data.worldId.slice(0, 60) : '';
      if (!worldId) throw new HttpsError('invalid-argument', 'Falta el mundo.');
      const r = crearSesion({
        id: randomBytes(6).toString('hex'),
        worldId,
        titulo: typeof request.data?.titulo === 'string' ? request.data.titulo : 'Clase en vivo',
        preguntas,
        segundos: Number(request.data?.segundos),
        uid: auth.uid,
        ahora,
      });
      if (!r.ok) fallar(r.error);
      // Una sesión nueva reemplaza la anterior con sus respuestas.
      await db.recursiveDelete(ref);
      await refClave.set(r.clave);
      await ref.set(r.sesion);
      await refUsoIa(auth.uid, ahora, db).set(
        { clasesVivo: FieldValue.increment(1), mes: mesBogota(ahora), actualizadoAt: ahora },
        { merge: true }
      );
      return { ok: true, sesion: r.sesion };
    }

    case 'siguiente': {
      return db.runTransaction(async (tx) => {
        const [s, c] = await Promise.all([tx.get(ref), tx.get(refClave)]);
        if (!s.exists || !c.exists) fallar('estado_invalido');
        const r = abrirSiguiente(s.data() as SesionVivo, c.data() as ClaveVivo, Date.now());
        if (!r.ok) fallar(r.error);
        tx.set(ref, r.sesion);
        return { ok: true, sesion: r.sesion };
      });
    }

    case 'revelar': {
      const s0 = await ref.get();
      if (!s0.exists) fallar('estado_invalido');
      const n = (s0.data() as SesionVivo).pregunta?.n;
      const [nombres, grupos, llegadas] = await Promise.all([
        activosDe(db, cursoPath),
        gruposDe(db, cursoPath),
        typeof n === 'number' ? ref.collection('respuestas').where('n', '==', n).get() : Promise.resolve(null),
      ]);
      const abiertaAt = (s0.data() as SesionVivo).pregunta?.abiertaAt ?? ahora;
      const respuestas = (llegadas?.docs ?? [])
        .map((d) => ({
          uid: d.get('uid') as string,
          r: Number(d.get('r')),
          creado: d.get('creadoAt') instanceof Timestamp ? (d.get('creadoAt') as Timestamp).toMillis() : ahora,
        }))
        .sort((a, b) => a.creado - b.creado)
        .map((x) => ({ uid: x.uid, r: x.r, ms: x.creado - abiertaAt }));
      const factores = await factoresDe(db, cursoPath, [...new Set(respuestas.map((r) => r.uid))].filter((u) => nombres[u]));
      return db.runTransaction(async (tx) => {
        const [s, c] = await Promise.all([tx.get(ref), tx.get(refClave)]);
        if (!s.exists || !c.exists) fallar('estado_invalido');
        const sesion = s.data() as SesionVivo;
        if (sesion.pregunta?.n !== n) fallar('estado_invalido');
        const r = revelarPregunta({
          sesion,
          clave: c.data() as ClaveVivo,
          respuestas,
          nombres,
          factores,
          grupos,
          ahora: Date.now(),
        });
        if (!r.ok) fallar(r.error);
        tx.set(ref, r.sesion);
        tx.set(refClave, r.clave);
        return { ok: true, sesion: r.sesion };
      });
    }

    case 'terminar': {
      const [s, c] = await Promise.all([ref.get(), refClave.get()]);
      if (!s.exists || !c.exists) fallar('estado_invalido');
      const previa = s.data() as SesionVivo;
      if (previa.estado === 'terminada') return { ok: true, sesion: previa };
      const sesion = terminarSesion(previa, ahora);
      const clave = c.data() as ClaveVivo;
      const nombres = await activosDe(db, cursoPath);
      const batch = db.batch();
      for (const [uid, intento] of Object.entries(intentosDeSesion(sesion, clave, ahora))) {
        // Solo queda registro de quien sigue activo (Ley 1581: autorizado).
        if (!nombres[uid]) continue;
        batch.set(db.collection(`${cursoPath}/estudiantes/${uid}/intentos`).doc(), {
          ...intento,
          creadoAt: FieldValue.serverTimestamp(),
        });
      }
      batch.set(db.doc(`${cursoPath}/sesionesVivo/${sesion.id}`), resumenSesion(sesion, clave));
      batch.set(ref, sesion);
      await batch.commit();
      return { ok: true, sesion };
    }

    case 'cerrar': {
      await db.recursiveDelete(ref);
      return { ok: true };
    }
  }
});
