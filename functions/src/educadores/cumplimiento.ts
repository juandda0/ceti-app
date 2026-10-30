/**
 * Fase 7 — cumplimiento y evidencia.
 *
 * - `gestionarPrueba`: el profe de la clase abre o cierra la prueba de entrada
 *   o de salida (`cursos/{k}/config/prueba`). Es de `prePostTest` (plan de
 *   entidad o Nave). Ver dominio/pruebaEntradaSalida.ts.
 * - `verCoberturaClase`: el informe de cobertura de la EEF de UNA clase, para
 *   el profe con Piloto o más (`informeCobertura`): la puerta de entrada al plan
 *   Colegio. Mismas cifras de grupo que el panel de la entidad.
 * - `cerrarPeriodoEntidad`: un admin de la entidad con licencia congela el
 *   informe de un periodo del SIEE en `colegios/{cid}/cierres/{anio}-p{n}`, con
 *   su huella SHA-256, para auditorías. Un cierre no se rehace ni se borra.
 */
import { createHash } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  DIA_MS,
  MENSAJES_ERROR_PRUEBA,
  calcularPanelEntidad,
  cambiarFase,
  esFasePrueba,
  evaluacionDesdeDoc,
  inicioDiaBogota,
  licenciaVigente,
  periodosDelAnio,
  puede,
  type ConfigPrueba,
  type PanelEntidad,
} from './dominio';
import { cursoPanel, leerRango } from './entidadPanel';
import { leerEntidad } from './entidades';
import { planDeProfe } from './plan';
import { exigirPermiso } from './permisos';

function profeConColegio(auth: { uid: string; token: Record<string, unknown> } | undefined): { uid: string; cid: string } {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const cid = auth.token.colegioId;
  if (auth.token.role !== 'profesor' || typeof cid !== 'string' || !cid) {
    throw new HttpsError('permission-denied', 'Solo para profes.');
  }
  return { uid: auth.uid, cid };
}

async function cursoDelProfe(db: Firestore, cid: string, cursoId: unknown, uid: string, accion: 'prueba' | 'ver') {
  if (typeof cursoId !== 'string' || !cursoId || cursoId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Falta la clase.');
  }
  const snap = await db.doc(`colegios/${cid}/cursos/${cursoId}`).get();
  exigirPermiso(snap, uid, accion);
  return snap;
}

async function exigirFuncion(uid: string, cid: string, funcion: 'prePostTest' | 'informeCobertura', mensaje: string) {
  const plan = await planDeProfe(uid, cid);
  if (!puede(plan, funcion)) {
    throw new HttpsError('failed-precondition', mensaje, { codigo: 'requiere_plan', funcion, plan });
  }
}

/** Abre o cierra la prueba de entrada (`pre`) o de salida (`post`) de una clase. */
export const gestionarPrueba = onCall(async (request) => {
  const { uid, cid } = profeConColegio(request.auth);
  const { cursoId, fase, abrir } = (request.data ?? {}) as Record<string, unknown>;
  if (!esFasePrueba(fase) || typeof abrir !== 'boolean') throw new HttpsError('invalid-argument', 'Fase o acción inválida.');
  const db = getFirestore();
  await cursoDelProfe(db, cid, cursoId, uid, 'prueba');
  await exigirFuncion(uid, cid, 'prePostTest', 'La prueba de entrada y salida viene con el plan de la institución.');
  const ref = db.doc(`colegios/${cid}/cursos/${cursoId as string}/config/prueba`);
  return db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    const r = cambiarFase(actual.exists ? (actual.data() as ConfigPrueba) : null, fase, abrir, uid, Date.now());
    if (!r.ok) throw new HttpsError('failed-precondition', MENSAJES_ERROR_PRUEBA[r.error], { codigo: r.error });
    tx.set(ref, r.config);
    return { ok: true, config: r.config };
  });
});

/** Cobertura de una sola clase (el profe con Piloto o más), con periodo opcional. */
export const verCoberturaClase = onCall(async (request): Promise<PanelEntidad> => {
  const { uid, cid } = profeConColegio(request.auth);
  const db = getFirestore();
  const curso = await cursoDelProfe(db, cid, request.data?.cursoId, uid, 'ver');
  await exigirFuncion(uid, cid, 'informeCobertura', 'El informe de cobertura de tu clase viene con el plan Piloto.');
  const ahora = Date.now();
  const rango = leerRango(request.data);
  const fila = await cursoPanel(db, cid, curso as FirebaseFirestore.QueryDocumentSnapshot, ahora, rango);
  const nombre = typeof request.auth?.token.name === 'string' ? request.auth.token.name : 'Profe';
  return calcularPanelEntidad([{ ...fila, archivada: false }], [{ uid, nombre, rol: 'profe' }], ahora, rango);
});

export function huellaDe(panel: PanelEntidad): string {
  return createHash('sha256').update(JSON.stringify(panel)).digest('hex');
}

export const rutaCierre = (cid: string, anio: number, numero: number) => `colegios/${cid}/cierres/${anio}-p${numero}`;

/** Congela el informe de un periodo del SIEE. */
export const cerrarPeriodoEntidad = onCall(async (request) => {
  const { uid, cid } = profeConColegio(request.auth);
  const anio = Number(request.data?.anio);
  const numero = Number(request.data?.periodo);
  if (!Number.isInteger(anio) || anio < 2024 || anio > 2100 || !Number.isInteger(numero) || numero < 1) {
    throw new HttpsError('invalid-argument', 'Periodo inválido.');
  }
  const db = getFirestore();
  const e = await leerEntidad(db, cid);
  const yo = e.profes.find((p) => p.uid === uid);
  if (!e.entidad || yo?.rol !== 'admin') throw new HttpsError('permission-denied', 'Solo un admin de la entidad.');
  const ahora = Date.now();
  if (!licenciaVigente(e.licencia, ahora)) {
    throw new HttpsError('failed-precondition', 'El cierre de periodo viene con el plan de la entidad.', { codigo: 'requiere_plan' });
  }
  const evaluacion = await db.doc(`colegios/${cid}/config/evaluacion`).get();
  const periodo = periodosDelAnio(evaluacion.exists ? evaluacionDesdeDoc(evaluacion.data()) : null, anio).find(
    (p) => p.numero === numero
  );
  if (!periodo) throw new HttpsError('invalid-argument', 'Ese periodo no existe en la escala de la entidad.');
  const rango = { desde: inicioDiaBogota(periodo.desde), hasta: inicioDiaBogota(periodo.hasta) + DIA_MS - 1 };
  if (rango.hasta > ahora) {
    throw new HttpsError('failed-precondition', 'El periodo todavía no termina.', { codigo: 'periodo_abierto' });
  }
  const ref = db.doc(rutaCierre(cid, anio, numero));
  if ((await ref.get()).exists) {
    throw new HttpsError('already-exists', 'Ese periodo ya está cerrado.', { codigo: 'ya_cerrado' });
  }
  const cursos = await db.collection(`colegios/${cid}/cursos`).get();
  const filas = [];
  for (const c of cursos.docs) filas.push(await cursoPanel(db, cid, c, ahora, rango));
  const panel = calcularPanelEntidad(
    filas,
    e.profes.map((p) => ({ uid: p.uid, nombre: p.nombre, rol: p.rol })),
    ahora,
    rango
  );
  const cierre = {
    anio,
    periodo: { numero, nombre: periodo.nombre, desde: periodo.desde, hasta: periodo.hasta },
    entidad: { nombre: e.entidad.nombre, tipo: e.entidad.tipo },
    panel,
    huella: huellaDe(panel),
    cerradoAt: ahora,
    cerradoPor: uid,
    cerradoPorNombre: yo.nombre,
  };
  // create() falla si otro admin cerró el mismo periodo un instante antes.
  await ref.create(cierre).catch(() => {
    throw new HttpsError('already-exists', 'Ese periodo ya está cerrado.', { codigo: 'ya_cerrado' });
  });
  return cierre;
});
