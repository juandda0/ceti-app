/**
 * Lectura y escritura de la suscripción en Firestore (solo servidor) y el plan
 * efectivo de un profe. Compartido por los módulos de cobros
 * (suscripciones.ts) y de límites (limites.ts, bitacoraSemanal.ts).
 *
 * `suscripciones/{uid}` guarda la `Suscripcion` del dominio más `planVigente` y
 * `vigenteHasta` (ms), que firestore.rules usa para permitir la edición de
 * contenido sin reimplementar el ciclo de vida.
 */
import { getFirestore, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import {
  mejorPlan,
  nuevaSuscripcion,
  planDeLicencia,
  planEfectivo,
  planEntidadDe,
  vigencia,
  type LicenciaEntidad,
  type PlanId,
  type Suscripcion,
} from './dominio';

export const COL_SUSCRIPCIONES = 'suscripciones';

/**
 * Licencia en `colegios/{cid}.licencia`: la Nave de antes ({plan: 'nave',
 * estudiantes}) o un plan de entidad de la Fase 6 (Equipo, Colegio,
 * Universidad).
 */
export type LicenciaColegio = LicenciaEntidad;

export function refSuscripcion(uid: string, db: Firestore = getFirestore()): DocumentReference {
  return db.collection(COL_SUSCRIPCIONES).doc(uid);
}

/** Campos que se persisten además de la Suscripcion. */
export function aDoc(sub: Suscripcion, ahora = Date.now()): Record<string, unknown> {
  const v = vigencia(sub);
  return { ...sub, planVigente: v.plan, vigenteHasta: v.hasta, actualizadoAt: ahora };
}

export async function leerSuscripcion(
  uid: string,
  tx?: Transaction,
  db: Firestore = getFirestore()
): Promise<Suscripcion | null> {
  const ref = refSuscripcion(uid, db);
  const snap = tx ? await tx.get(ref) : await ref.get();
  return snap.exists ? (snap.data() as Suscripcion) : null;
}

/** Escribe la suscripción completa (sobrescribe; la fuente de verdad es el dominio). */
export function guardarSuscripcion(
  sub: Suscripcion,
  tx?: Transaction,
  db: Firestore = getFirestore()
): Promise<unknown> | void {
  const ref = refSuscripcion(sub.uid, db);
  if (tx) {
    tx.set(ref, aDoc(sub));
    return;
  }
  return ref.set(aDoc(sub));
}

/** Crea la prueba de 14 días si el profe aún no tiene suscripción. Nunca sobrescribe. */
export async function asegurarSuscripcion(uid: string, db: Firestore = getFirestore()): Promise<void> {
  const ref = refSuscripcion(uid, db);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) tx.set(ref, aDoc(nuevaSuscripcion(uid, Date.now())));
  });
}

export async function licenciaDeColegio(
  colegioId: string | null | undefined,
  db: Firestore = getFirestore()
): Promise<LicenciaColegio | null> {
  if (!colegioId) return null;
  const snap = await db.doc(`colegios/${colegioId}`).get();
  const l = snap.exists ? (snap.data()?.licencia as LicenciaColegio | undefined) : undefined;
  return l && planEntidadDe(l) !== null ? l : null;
}

/**
 * Plan que vale hoy: el mejor entre la suscripción individual y la licencia de
 * su colegio o entidad (Equipo → Comandante; Colegio, Universidad y Nave → Nave).
 */
export async function planDeProfe(
  uid: string,
  colegioId: string | null | undefined,
  ahora = Date.now(),
  db: Firestore = getFirestore()
): Promise<PlanId> {
  const [sub, licencia] = await Promise.all([leerSuscripcion(uid, undefined, db), licenciaDeColegio(colegioId, db)]);
  return mejorPlan(planEfectivo(sub, ahora), planDeLicencia(licencia, ahora));
}

/** 'YYYY-MM' del mes en curso en Bogotá, para el contador de IA. */
export function mesBogota(ahora = Date.now()): string {
  return new Date(ahora - 5 * 60 * 60 * 1000).toISOString().slice(0, 7);
}
