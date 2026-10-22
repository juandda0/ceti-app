/**
 * Lectura de la suscripción del profe y llamadas de cobro. Solo el servidor
 * escribe `suscripciones/{uid}`, `pagos/*` y la licencia del colegio; la app
 * lee (firestore.rules: dueño) y pide cambios por Cloud Functions.
 *
 * Modelo (docs/educadores/modelo-datos.md):
 * - suscripciones/{uid}: `Suscripcion` + `planVigente` + `vigenteHasta` (ms)
 * - suscripciones/{uid}/uso/{YYYY-MM}: { iaGeneraciones }
 * - pagos/{pagoId}: `PagoDoc` (uid = dueño)
 * - colegios/{cid}.licencia: `LicenciaColegio` (Nave)
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type {
  Ciclo,
  MetodoPago,
  PlanId,
  PlanIndividual,
  Suscripcion,
} from '@/functions/src/educadores/dominio';

export const COLECCION_SUSCRIPCIONES = 'suscripciones';
export const COLECCION_PAGOS = 'pagos';

export type SuscripcionDoc = Suscripcion & {
  planVigente: PlanId;
  vigenteHasta: number;
};

export interface LicenciaColegio {
  plan: 'nave';
  /** ms */
  hasta: number;
  estudiantes: number;
  /** Nombre del padrino, si un aliado paga la licencia. */
  padrino?: string | null;
}

export type EstadoPago =
  | 'pendiente'
  | 'aprobado'
  | 'rechazado'
  | 'reembolso_pendiente'
  | 'reembolsado';

export interface PagoDoc {
  id: string;
  uid: string;
  referencia: string;
  plan: PlanIndividual;
  ciclo: Ciclo;
  montoCop: number;
  estado: EstadoPago;
  metodo: MetodoPago | null;
  /** 'checkout' = pago único en Wompi; 'recurrente' = cobro automático. */
  tipo: 'checkout' | 'recurrente' | 'reembolso';
  creadoAt: number;
  facturaUrl?: string | null;
}

export type AccionSuscripcion = 'pausar' | 'reanudar' | 'cancelar' | 'revertirCancelacion';

export interface ResultadoCheckout {
  url: string;
  referencia: string;
  montoCop: number;
  fundador: boolean;
}

export interface ResultadoGestion {
  ok: true;
  estado: Suscripcion['estado'];
  reembolso: boolean;
  accesoHasta: number | null;
}

/** Fuente reemplazable por los datos de ejemplo de /dev/profe. */
export const suscripcionRepository = {
  escucharSuscripcion(uid: string, cb: (s: SuscripcionDoc | null) => void): Unsubscribe {
    const clients = getFirebaseClients();
    if (!clients?.firestore) {
      cb(null);
      return () => undefined;
    }
    return onSnapshot(
      doc(clients.firestore, COLECCION_SUSCRIPCIONES, uid),
      (snap) => cb(snap.exists() ? (snap.data() as SuscripcionDoc) : null),
      () => cb(null)
    );
  },

  escucharLicencia(colegioId: string, cb: (l: LicenciaColegio | null) => void): Unsubscribe {
    const clients = getFirebaseClients();
    if (!clients?.firestore) {
      cb(null);
      return () => undefined;
    }
    return onSnapshot(
      doc(clients.firestore, 'colegios', colegioId),
      (snap) => {
        const l = snap.exists() ? (snap.data().licencia as LicenciaColegio | undefined) : undefined;
        cb(l && l.plan === 'nave' ? l : null);
      },
      () => cb(null)
    );
  },

  /** Generaciones de IA usadas en el mes 'YYYY-MM'. */
  async usoIaDelMes(uid: string, mes: string): Promise<number> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return 0;
    const snap = await getDoc(doc(clients.firestore, COLECCION_SUSCRIPCIONES, uid, 'uso', mes));
    return snap.exists() ? ((snap.data().iaGeneraciones as number | undefined) ?? 0) : 0;
  },

  async pagos(uid: string): Promise<PagoDoc[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(
      query(
        collection(clients.firestore, COLECCION_PAGOS),
        where('uid', '==', uid),
        orderBy('creadoAt', 'desc'),
        limit(24)
      )
    );
    return snap.docs.map((d) => ({ ...(d.data() as Omit<PagoDoc, 'id'>), id: d.id }));
  },

  /** Pago único por Wompi Web Checkout (tarjeta, PSE, Nequi, Bancolombia). */
  crearCheckout(plan: PlanIndividual, ciclo: Ciclo, redirectUrl?: string): Promise<ResultadoCheckout> {
    return callFunction<ResultadoCheckout>('crearCheckoutPlan', { plan, ciclo, redirectUrl });
  },

  /** Cobro automático con Nequi: el profe aprueba la suscripción en su app de Nequi. */
  suscribirConNequi(plan: PlanIndividual, ciclo: Ciclo, telefono: string) {
    return callFunction<{ ok: true; referencia: string }>('suscribirConMedio', {
      plan,
      ciclo,
      medio: { tipo: 'NEQUI', telefono },
    });
  },

  /** Cobro automático con tarjeta: `token` viene de Wompi (los datos de la tarjeta nunca pasan por Ceti). */
  suscribirConTarjeta(plan: PlanIndividual, ciclo: Ciclo, token: string) {
    return callFunction<{ ok: true; referencia: string }>('suscribirConMedio', {
      plan,
      ciclo,
      medio: { tipo: 'CARD', token },
    });
  },

  gestionar(accion: AccionSuscripcion, hasta?: number): Promise<ResultadoGestion> {
    return callFunction<ResultadoGestion>('gestionarSuscripcion', { accion, hasta });
  },

  /** Precio que vería hoy (aplica tarifa fundador si quedan cupos). */
  cotizar(plan: PlanIndividual, ciclo: Ciclo) {
    return callFunction<{ montoCop: number; fundador: boolean; cuposFundador: number }>(
      'cotizarPlan',
      { plan, ciclo }
    );
  },
};
