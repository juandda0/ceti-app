/**
 * Fase 6 — entidades (ver dominio/entidad.ts). Una entidad es un colegio de
 * Ceti compartido por varios profes; el admin es un permiso de un profesor
 * (`colegios/{cid}/profes/{uid}.rol`). Solo estos callables escriben, con el
 * Admin SDK:
 *
 * - `colegios/{cid}.entidad` y `colegios/{cid}/profes/{uid}`: la entidad y sus
 *   miembros (los leen los profes de la entidad).
 * - `colegios/{cid}/invitacionesProfe/{correo}` (lo lee un admin) y
 *   `invitacionesProfe/{cid}:{correo}` (búsqueda por correo, solo servidor).
 * - Al aceptar, las clases del profe se mudan a la entidad con todo su árbol
 *   (estudiantes, avance, contenido, comunicados…), y se reescriben los claims
 *   de sus estudiantes, el código de la clase, las invitaciones pendientes y los
 *   enlaces de acudiente. Al salir, las clases se quedan en la entidad.
 * - Co-docentes: `cursos/{k}.profesorUids`, solo entre miembros.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  getFirestore,
  type BulkWriter,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  MENSAJES_ERROR_CODOCENTE,
  MENSAJES_ERROR_ENTIDAD,
  cambiarCoDocente,
  cambiarPermiso,
  MENSAJES_ERROR_PERMISO,
  permisoEnClase,
  soloCalificarSin,
  esRolEntidad,
  esTipoEntidad,
  invitacionVigente,
  licenciaVigente,
  limpiarNombreEntidad,
  normalizarCorreo,
  profesTrasSalida,
  puedeInvitar,
  validarCambioRol,
  validarSalida,
  type DatosEntidad,
  type InvitacionProfe,
  type LicenciaEntidad,
  type ProfeEntidad,
  type RolEntidad,
} from './dominio';
import { clasesDeClaims } from './clasesEstudiante';
import { encolarCorreo } from './correo';
import { URL_APP } from './invitaciones';

export const COL_INVITACIONES_PROFE = 'invitacionesProfe';

const refProfe = (db: Firestore, cid: string, uid: string) => db.doc(`colegios/${cid}/profes/${uid}`);
const refInvitacion = (db: Firestore, cid: string, correo: string) =>
  db.doc(`colegios/${cid}/invitacionesProfe/${correo}`);
const refBusqueda = (db: Firestore, cid: string, correo: string) =>
  db.doc(`${COL_INVITACIONES_PROFE}/${cid}:${correo}`);

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export interface EstadoEntidad {
  colegioId: string;
  entidad: DatosEntidad | null;
  licencia: LicenciaEntidad | null;
  profes: ProfeEntidad[];
}

export async function leerEntidad(db: Firestore, colegioId: string): Promise<EstadoEntidad> {
  const [colegio, profes] = await Promise.all([
    db.doc(`colegios/${colegioId}`).get(),
    db.collection(`colegios/${colegioId}/profes`).get(),
  ]);
  return {
    colegioId,
    entidad: (colegio.get('entidad') as DatosEntidad | undefined) ?? null,
    licencia: (colegio.get('licencia') as LicenciaEntidad | undefined) ?? null,
    profes: profes.docs.map((d) => ({ ...(d.data() as ProfeEntidad), uid: d.id })),
  };
}

function exigirAdmin(e: EstadoEntidad, uid: string): void {
  if (!e.entidad) throw new HttpsError('failed-precondition', 'Tu colegio todavía no es una entidad.');
  if (e.profes.find((p) => p.uid === uid)?.rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin de la entidad puede hacer esto.');
  }
}

interface Profe {
  uid: string;
  colegioId: string;
  correo: string | null;
  nombre: string;
}

function exigirProfe(request: CallableRequest): Profe {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (caller.token.role !== 'profesor') throw new HttpsError('permission-denied', 'Solo para profes.');
  const colegioId = caller.token.colegioId;
  if (typeof colegioId !== 'string' || !colegioId) {
    throw new HttpsError('failed-precondition', 'Tu cuenta no tiene un colegio asignado.');
  }
  const correo = typeof caller.token.email === 'string' ? caller.token.email.toLowerCase() : null;
  const nombre = typeof caller.token.name === 'string' && caller.token.name.trim() ? caller.token.name.trim() : correo ?? 'Profe';
  return { uid: caller.uid, colegioId, correo, nombre };
}

function errorEntidad(error: keyof typeof MENSAJES_ERROR_ENTIDAD): never {
  throw new HttpsError('failed-precondition', MENSAJES_ERROR_ENTIDAD[error], { codigo: error });
}

/** Claims del profe + su espejo en membership/{uid} (como applyClaims en index.ts). */
async function fijarClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  await getAuth().setCustomUserClaims(uid, claims);
  await getFirestore()
    .doc(`membership/${uid}`)
    .set({ ...claims, claimsUpdatedAt: FieldValue.serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Mudanza de clases a la entidad
// ---------------------------------------------------------------------------

/**
 * Claims de un estudiante cuya clase `cursoId` se mudó a `destino`; null si no
 * la tenía. Los tokens de antes (colegioId/cursoId) quedan en el formato nuevo.
 */
export function claimsTrasMudanza(
  claims: Record<string, unknown> | undefined,
  cursoId: string,
  destino: string
): Record<string, unknown> | null {
  if (claims?.role !== 'estudiante') return null;
  const clases = clasesDeClaims(claims);
  if (!(cursoId in clases)) return null;
  clases[cursoId] = destino;
  return { role: 'estudiante', clases };
}

type Transformar = (ruta: string, data: DocumentData) => DocumentData;

async function copiarArbol(
  src: DocumentReference,
  dst: DocumentReference,
  writer: BulkWriter,
  transformar: Transformar
): Promise<number> {
  let n = 0;
  const snap = await src.get();
  if (snap.exists) {
    void writer.set(dst, transformar(src.path, snap.data() ?? {}));
    n += 1;
  }
  for (const sub of await src.listCollections()) {
    for (const ref of await sub.listDocuments()) {
      n += await copiarArbol(ref, dst.collection(sub.id).doc(ref.id), writer, transformar);
    }
  }
  return n;
}

export interface ResultadoMudanza {
  clases: number;
  estudiantes: number;
  documentos: number;
}

/** Muda una clase de `origen` a `destino` con todo lo que cuelga de ella. */
export async function mudarClase(
  db: Firestore,
  origen: string,
  destino: string,
  cursoId: string
): Promise<{ estudiantes: number; documentos: number }> {
  const src = db.doc(`colegios/${origen}/cursos/${cursoId}`);
  const dst = db.doc(`colegios/${destino}/cursos/${cursoId}`);
  const [previo, actual] = await Promise.all([dst.get(), src.get()]);
  if (previo.exists) throw new HttpsError('already-exists', 'Ya hay una clase con ese id en la entidad.');
  if (!actual.exists) return { estudiantes: 0, documentos: 0 };

  const writer = db.bulkWriter();
  // El avance lleva colegioId denormalizado (las reglas y el agregado lo usan).
  const documentos = await copiarArbol(src, dst, writer, (ruta, data) =>
    ruta.includes('/progress/') && data.colegioId === origen ? { ...data, colegioId: destino } : data
  );
  const asignaciones = await db.collection(`colegios/${origen}/asignaciones`).where('target.cursoId', '==', cursoId).get();
  for (const a of asignaciones.docs) void writer.set(db.doc(`colegios/${destino}/asignaciones/${a.id}`), a.data());
  await writer.close();

  const codigo = actual.get('codigo');
  if (typeof codigo === 'string' && codigo) {
    await db.doc(`classCodes/${codigo}`).set({ colegioId: destino }, { merge: true });
  }
  // Fase 8: la verificación pública de los certificados guarda el colegio.
  for (const col of ['invitacionesPorCorreo', 'enlacesAcudiente', 'certificados']) {
    const q = await db.collection(col).where('colegioId', '==', origen).where('cursoId', '==', cursoId).get();
    await Promise.all(q.docs.map((d) => d.ref.update({ colegioId: destino })));
  }

  const roster = await dst.collection('estudiantes').get();
  for (const e of roster.docs) {
    try {
      const user = await getAuth().getUser(e.id);
      const nuevos = claimsTrasMudanza(user.customClaims, cursoId, destino);
      if (nuevos) await fijarClaims(e.id, nuevos);
    } catch (err) {
      // Un estudiante suprimido o borrado de Auth no frena la mudanza.
      console.warn('mudarClase: no se pudieron mover los claims', { uid: e.id, err: String(err) });
    }
  }

  await db.recursiveDelete(src);
  await Promise.all(asignaciones.docs.map((a) => a.ref.delete()));
  return { estudiantes: roster.size, documentos: documentos + asignaciones.size };
}

/** Muda todas las clases del profe en `origen` a la entidad `destino`. */
export async function mudarClasesDeProfe(
  db: Firestore,
  uid: string,
  origen: string,
  destino: string
): Promise<ResultadoMudanza> {
  const cursos = await db.collection(`colegios/${origen}/cursos`).where('profesorUids', 'array-contains', uid).get();
  const r: ResultadoMudanza = { clases: 0, estudiantes: 0, documentos: 0 };
  for (const c of cursos.docs) {
    const m = await mudarClase(db, origen, destino, c.id);
    r.clases += 1;
    r.estudiantes += m.estudiantes;
    r.documentos += m.documentos;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Callables
// ---------------------------------------------------------------------------

/** Convierte el colegio del profe en una entidad y lo deja como su primer admin. */
export const crearEntidad = onCall(async (request) => {
  const p = exigirProfe(request);
  const nombre = limpiarNombreEntidad(request.data?.nombre);
  if (!nombre) errorEntidad('nombre_invalido');
  const tipo = request.data?.tipo;
  if (!esTipoEntidad(tipo)) throw new HttpsError('invalid-argument', "El tipo debe ser 'colegio', 'universidad' o 'academia'.");
  const db = getFirestore();
  const ref = db.doc(`colegios/${p.colegioId}`);
  const ahora = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos tu colegio.');
    if (snap.get('entidad')) throw new HttpsError('already-exists', 'Tu colegio ya es una entidad.');
    const entidad: DatosEntidad = { nombre, tipo, creadaAt: ahora, creadaPor: p.uid };
    tx.update(ref, { entidad, nombre });
    const profe: ProfeEntidad = { uid: p.uid, nombre: p.nombre, correo: p.correo, rol: 'admin', unidoAt: ahora };
    tx.set(refProfe(db, p.colegioId, p.uid), profe);
  });
  return { ok: true, colegioId: p.colegioId };
});

/** Un admin invita a un profe por correo. */
export const invitarProfeEntidad = onCall(async (request) => {
  const p = exigirProfe(request);
  const db = getFirestore();
  const e = await leerEntidad(db, p.colegioId);
  exigirAdmin(e, p.uid);
  const rol: RolEntidad = esRolEntidad(request.data?.rol) ? request.data.rol : 'profe';
  const pendientes = await db.collection(`colegios/${p.colegioId}/invitacionesProfe`).get();
  const ahora = Date.now();
  const vigentes = pendientes.docs
    .map((d) => d.data() as InvitacionProfe)
    .filter((i) => invitacionVigente(i, ahora));
  const r = puedeInvitar(request.data?.correo, e.profes, vigentes, e.licencia, ahora);
  if (!r.ok) errorEntidad(r.error);
  const correo = r.valor;
  const inv: InvitacionProfe = {
    correo,
    rol,
    invitadoPor: p.uid,
    invitadoPorNombre: p.nombre,
    creadaAt: ahora,
  };
  await refInvitacion(db, p.colegioId, correo).set(inv);
  await refBusqueda(db, p.colegioId, correo).set({ ...inv, colegioId: p.colegioId });
  try {
    await encolarCorreo(db, {
      to: correo,
      plantilla: 'invitacion_entidad',
      datos: {
        colegio: e.entidad?.nombre ?? null,
        profe: p.nombre,
        correoInvitado: correo,
        enlace: URL_APP.value() || null,
      },
    });
  } catch (err) {
    console.error('invitarProfeEntidad: no se pudo encolar el correo', { err: String(err) });
  }
  return { ok: true, correo };
});

/** Un admin retira una invitación pendiente. */
export const cancelarInvitacionProfe = onCall(async (request) => {
  const p = exigirProfe(request);
  const db = getFirestore();
  exigirAdmin(await leerEntidad(db, p.colegioId), p.uid);
  const correo = normalizarCorreo(request.data?.correo);
  if (!correo) errorEntidad('correo_invalido');
  await Promise.all([refInvitacion(db, p.colegioId, correo).delete(), refBusqueda(db, p.colegioId, correo).delete()]);
  return { ok: true };
});

export interface InvitacionParaMi {
  colegioId: string;
  entidad: string;
  tipo: string | null;
  invitadoPorNombre: string | null;
  rol: RolEntidad;
  creadaAt: number;
  /** Cuántas clases del profe pasarían a la entidad. */
  clases: number;
}

/** Las invitaciones vigentes para el correo del profe. */
export const misInvitacionesEntidad = onCall(async (request): Promise<{ invitaciones: InvitacionParaMi[] }> => {
  const p = exigirProfe(request);
  if (!p.correo) return { invitaciones: [] };
  const db = getFirestore();
  const ahora = Date.now();
  const [q, mias] = await Promise.all([
    db.collection(COL_INVITACIONES_PROFE).where('correo', '==', p.correo).get(),
    db.collection(`colegios/${p.colegioId}/cursos`).where('profesorUids', 'array-contains', p.uid).count().get(),
  ]);
  const invitaciones: InvitacionParaMi[] = [];
  for (const d of q.docs) {
    const inv = d.data() as InvitacionProfe & { colegioId: string };
    if (inv.colegioId === p.colegioId || !invitacionVigente(inv, ahora)) continue;
    const colegio = await db.doc(`colegios/${inv.colegioId}`).get();
    const entidad = colegio.get('entidad') as DatosEntidad | undefined;
    if (!entidad) continue;
    invitaciones.push({
      colegioId: inv.colegioId,
      entidad: entidad.nombre,
      tipo: entidad.tipo ?? null,
      invitadoPorNombre: inv.invitadoPorNombre ?? null,
      rol: inv.rol,
      creadaAt: inv.creadaAt,
      clases: mias.data().count,
    });
  }
  return { invitaciones };
});

/** El profe acepta (y sus clases se mudan) o rechaza una invitación. */
export const responderInvitacionEntidad = onCall(async (request) => {
  const p = exigirProfe(request);
  if (!p.correo) throw new HttpsError('failed-precondition', 'Tu cuenta no tiene correo.');
  const destino = request.data?.colegioId;
  if (typeof destino !== 'string' || !destino || destino.includes('/')) {
    throw new HttpsError('invalid-argument', 'Falta la entidad.');
  }
  const db = getFirestore();
  const busqueda = refBusqueda(db, destino, p.correo);
  const snap = await busqueda.get();
  const inv = snap.data() as (InvitacionProfe & { colegioId: string }) | undefined;
  if (!inv || !invitacionVigente(inv, Date.now())) {
    throw new HttpsError('not-found', 'La invitación ya no está vigente. Pide una nueva.');
  }
  const cerrar = () => Promise.all([busqueda.delete(), refInvitacion(db, destino, p.correo as string).delete()]);
  if (request.data?.aceptar !== true) {
    await cerrar();
    return { ok: true, aceptada: false };
  }
  if (destino === p.colegioId) throw new HttpsError('already-exists', 'Ya estás en esa entidad.');

  const [origen, entidad] = await Promise.all([leerEntidad(db, p.colegioId), leerEntidad(db, destino)]);
  if (!entidad.entidad) throw new HttpsError('not-found', 'Esa entidad ya no existe.');
  if (origen.entidad && origen.profes.some((x) => x.uid !== p.uid)) {
    throw new HttpsError('failed-precondition', 'Primero sal de tu entidad actual (Colegio → Salir de la entidad).', {
      codigo: 'ya_en_entidad',
    });
  }
  if (entidad.profes.some((x) => x.uid === p.uid)) errorEntidad('ya_es_miembro');

  const mudanza = await mudarClasesDeProfe(db, p.uid, p.colegioId, destino);
  const profe: ProfeEntidad & { colegioPersonal: string } = {
    uid: p.uid,
    nombre: p.nombre,
    correo: p.correo,
    rol: esRolEntidad(inv.rol) ? inv.rol : 'profe',
    unidoAt: Date.now(),
    colegioPersonal: p.colegioId,
  };
  await refProfe(db, destino, p.uid).set(profe);
  if (origen.entidad) await refProfe(db, p.colegioId, p.uid).delete();
  await fijarClaims(p.uid, { role: 'profesor', colegioId: destino });
  await cerrar();
  console.info('responderInvitacionEntidad: profe unido', { uid: p.uid, destino, ...mudanza });
  return { ok: true, aceptada: true, colegioId: destino, clases: mudanza.clases, estudiantes: mudanza.estudiantes };
});

/** Un colegio propio para el profe que sale de la entidad (el de antes, si sigue ahí). */
async function colegioPersonal(db: Firestore, uid: string, previo: unknown): Promise<string> {
  if (typeof previo === 'string' && previo) {
    const snap = await db.doc(`colegios/${previo}`).get();
    if (snap.exists && !snap.get('entidad')) return previo;
  }
  const ref = db.collection('colegios').doc();
  await ref.set({ nombre: 'Mi colegio', sedesEnabled: false, createdAt: FieldValue.serverTimestamp(), createdByUid: uid });
  return ref.id;
}

/**
 * Un admin saca a un profe, o un profe sale por su cuenta. Sus clases se quedan
 * en la entidad: si quedan sin profe pasan a `pasarA` (un miembro) o esperan a
 * que un admin las asigne.
 */
export const sacarProfeEntidad = onCall(async (request) => {
  const p = exigirProfe(request);
  const db = getFirestore();
  const e = await leerEntidad(db, p.colegioId);
  if (!e.entidad) throw new HttpsError('failed-precondition', 'Tu colegio no es una entidad.');
  const uid = typeof request.data?.uid === 'string' && request.data.uid ? request.data.uid : p.uid;
  const yo = e.profes.find((x) => x.uid === p.uid);
  if (uid !== p.uid && yo?.rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin de la entidad puede sacar a otro profe.');
  }
  if (e.profes.length <= 1) {
    throw new HttpsError('failed-precondition', 'Eres el único profe de la entidad.', { codigo: 'unico_profe' });
  }
  const v = validarSalida(e.profes, uid);
  if (!v.ok) errorEntidad(v.error);
  const pasarA = typeof request.data?.pasarA === 'string' ? request.data.pasarA : null;
  if (pasarA && (pasarA === uid || !e.profes.some((x) => x.uid === pasarA))) errorEntidad('no_es_miembro');

  const cursos = await db.collection(`colegios/${p.colegioId}/cursos`).where('profesorUids', 'array-contains', uid).get();
  let sinProfe = 0;
  for (const c of cursos.docs) {
    const nuevos = profesTrasSalida((c.get('profesorUids') ?? []) as string[], uid, pasarA);
    if (nuevos.length === 0) sinProfe += 1;
    await c.ref.update({ profesorUids: nuevos, soloCalificar: soloCalificarSin(c.data(), uid) });
  }
  const miembro = await refProfe(db, p.colegioId, uid).get();
  const personal = await colegioPersonal(db, uid, miembro.get('colegioPersonal'));
  await fijarClaims(uid, { role: 'profesor', colegioId: personal });
  await miembro.ref.delete();
  return { ok: true, clases: cursos.size, sinProfe, colegioId: personal };
});

/** Un admin cambia el rol de un miembro (siempre queda al menos un admin). */
export const cambiarRolProfeEntidad = onCall(async (request) => {
  const p = exigirProfe(request);
  const db = getFirestore();
  const e = await leerEntidad(db, p.colegioId);
  exigirAdmin(e, p.uid);
  const uid = request.data?.uid;
  const rol = request.data?.rol;
  if (typeof uid !== 'string' || !esRolEntidad(rol)) throw new HttpsError('invalid-argument', 'Falta el profe o el rol.');
  const v = validarCambioRol(e.profes, uid, rol);
  if (!v.ok) errorEntidad(v.error);
  await refProfe(db, p.colegioId, uid).update({ rol });
  return { ok: true };
});

/**
 * Agrega o quita un co-docente de una clase de la entidad. Lo hace un profe de
 * la clase o un admin (también para asignar una clase que quedó sin profe).
 */
export const gestionarCoDocente = onCall(async (request) => {
  const p = exigirProfe(request);
  const cursoId = request.data?.cursoId;
  const uid = request.data?.uid;
  const accion = request.data?.accion;
  const permiso = request.data?.permiso;
  if (
    typeof cursoId !== 'string' || !cursoId || typeof uid !== 'string' || !uid ||
    (accion !== 'agregar' && accion !== 'quitar' && accion !== 'permiso') ||
    (accion === 'permiso' && permiso !== 'edita' && permiso !== 'califica')
  ) {
    throw new HttpsError('invalid-argument', 'Falta la clase, el profe o la acción.');
  }
  const db = getFirestore();
  const e = await leerEntidad(db, p.colegioId);
  if (!e.entidad) throw new HttpsError('failed-precondition', 'Los co-docentes son para entidades.', { codigo: 'sin_entidad' });
  if (!licenciaVigente(e.licencia, Date.now())) {
    throw new HttpsError('failed-precondition', 'Los co-docentes vienen con el plan de la entidad.', { codigo: 'requiere_plan' });
  }
  const ref = db.doc(`colegios/${p.colegioId}/cursos/${cursoId}`);
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos la clase.');
    const actuales = (snap.get('profesorUids') ?? []) as string[];
    const esAdmin = e.profes.find((x) => x.uid === p.uid)?.rol === 'admin';
    // F9: cambia los profes quien edita la clase o un admin de la entidad.
    if (permisoEnClase(snap.data(), p.uid) !== 'edita' && !esAdmin) {
      throw new HttpsError('permission-denied', 'Solo un profe que edita la clase o un admin.');
    }
    if (accion === 'permiso') {
      const r = cambiarPermiso(snap.data() ?? {}, uid, permiso);
      if (!r.ok) throw new HttpsError('failed-precondition', MENSAJES_ERROR_PERMISO[r.error], { codigo: r.error });
      tx.update(ref, { soloCalificar: r.soloCalificar });
      return { profesorUids: actuales, soloCalificar: r.soloCalificar };
    }
    const r = cambiarCoDocente(actuales, new Set(e.profes.map((x) => x.uid)), uid, accion);
    if (!r.ok) {
      throw new HttpsError('failed-precondition', MENSAJES_ERROR_CODOCENTE[r.error], { codigo: r.error });
    }
    let soloCalificar = soloCalificarSin(snap.data() ?? {}, accion === 'quitar' ? uid : '');
    // Se puede sumar a alguien directamente como «ve y califica».
    if (accion === 'agregar' && permiso === 'califica') soloCalificar = [...soloCalificar, uid];
    tx.update(ref, { profesorUids: r.profesorUids, soloCalificar });
    return { profesorUids: r.profesorUids, soloCalificar };
  });
  return { ok: true, ...resultado };
});
