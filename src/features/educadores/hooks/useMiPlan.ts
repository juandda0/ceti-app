/**
 * El plan del profe en la app: su suscripción y la licencia Nave de su colegio,
 * en vivo. Una sola suscripción por sesión (store compartido), así todas las
 * pantallas del profe ven el mismo plan sin volver a leerlo.
 *
 * El servidor hace cumplir los límites de verdad (Cloud Functions y
 * firestore.rules). Esto solo decide qué mostrar y cuándo abrir el muro.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  diasDePrueba,
  limites as limitesDe,
  mejorPlan,
  planEfectivo,
  puede as puedePlan,
  type Funcion,
  type LimitesPlan,
  type PlanId,
} from '@/functions/src/educadores/dominio';
import {
  suscripcionRepository,
  type LicenciaColegio,
  type SuscripcionDoc,
} from '../data/suscripcionRepository';

interface EstadoPlan {
  uid: string | null;
  colegioId: string | null;
  sub: SuscripcionDoc | null;
  licencia: LicenciaColegio | null;
  cargando: boolean;
  /** Instante de la última actualización (para recalcular vencimientos). */
  ahora: number;
}

const usePlanStore = create<EstadoPlan>(() => ({
  uid: null,
  colegioId: null,
  sub: null,
  licencia: null,
  cargando: true,
  ahora: Date.now(),
}));

let suscripciones: { uid: string | null; colegioId: string | null; cancelar: () => void } = {
  uid: null,
  colegioId: null,
  cancelar: () => undefined,
};
let consumidores = 0;

function conectar(uid: string | null, colegioId: string | null) {
  if (suscripciones.uid === uid && suscripciones.colegioId === colegioId) return;
  suscripciones.cancelar();
  usePlanStore.setState({ uid, colegioId, sub: null, licencia: null, cargando: !!uid });
  if (!uid) {
    suscripciones = { uid, colegioId, cancelar: () => undefined };
    return;
  }
  let subListo = false;
  let licListo = !colegioId;
  const listo = () => {
    if (subListo && licListo) usePlanStore.setState({ cargando: false, ahora: Date.now() });
  };
  const offSub = suscripcionRepository.escucharSuscripcion(uid, (sub) => {
    subListo = true;
    usePlanStore.setState({ sub, ahora: Date.now() });
    listo();
  });
  const offLic = colegioId
    ? suscripcionRepository.escucharLicencia(colegioId, (licencia) => {
        licListo = true;
        usePlanStore.setState({ licencia, ahora: Date.now() });
        listo();
      })
    : () => undefined;
  suscripciones = {
    uid,
    colegioId,
    cancelar: () => {
      offSub();
      offLic();
    },
  };
}

/** Plan efectivo combinando la suscripción individual y la licencia del colegio. */
export function calcularPlan(
  sub: SuscripcionDoc | null,
  licencia: LicenciaColegio | null,
  ahora: number
): PlanId {
  const individual = planEfectivo(sub, ahora);
  const colegio: PlanId = licencia && ahora < licencia.hasta ? 'nave' : 'cadete';
  return mejorPlan(individual, colegio);
}

export interface MiPlan {
  plan: PlanId;
  sub: SuscripcionDoc | null;
  licencia: LicenciaColegio | null;
  cargando: boolean;
  /** Días de prueba que quedan (0 si no está en prueba). */
  diasPrueba: number;
  /** El plan viene del colegio (Nave), no de un pago individual. */
  porColegio: boolean;
  limites: LimitesPlan;
  puede: (f: Funcion) => boolean;
}

export function useMiPlan(): MiPlan {
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const { sub, licencia, cargando, ahora } = usePlanStore();

  useEffect(() => {
    consumidores += 1;
    conectar(uid, colegioId);
    return () => {
      consumidores -= 1;
      if (consumidores === 0) {
        suscripciones.cancelar();
        suscripciones = { uid: null, colegioId: null, cancelar: () => undefined };
      }
    };
  }, [uid, colegioId]);

  const t = Math.max(ahora, Date.now());
  const plan = calcularPlan(sub, licencia, t);
  return {
    plan,
    sub,
    licencia,
    cargando,
    diasPrueba: diasDePrueba(sub, t),
    porColegio: plan === 'nave',
    limites: limitesDe(plan),
    puede: (f) => puedePlan(plan, f),
  };
}

/** Solo para pruebas y la ruta /dev/profe: fija el estado sin Firestore. */
export function fijarPlanDePrueba(estado: Partial<Omit<EstadoPlan, 'ahora'>>): void {
  usePlanStore.setState({ ...estado, cargando: false, ahora: Date.now() });
}
