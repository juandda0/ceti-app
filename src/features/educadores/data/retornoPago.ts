/**
 * Regreso de Wompi Web Checkout (`/pago?id=<transactionId>`): Wompi no devuelve
 * nuestra referencia, así que se sigue el pago único más reciente del profe
 * (`pagos/*`, lo escribe el servidor con el webhook) y, de respaldo, la
 * suscripción. Puro.
 */
import type { PagoDoc, SuscripcionDoc } from './suscripcionRepository';
import type { PlanIndividual } from '@/functions/src/educadores/dominio';

/** Un pago cuenta como "este" si se creó en las últimas horas. */
export const VENTANA_RETORNO_MS = 3 * 60 * 60 * 1000;
/** Después de esto se deja de esperar en pantalla y se promete el correo. */
export const ESPERA_RETORNO_MS = 60 * 1000;

export type EstadoRetorno =
  | { estado: 'pendiente' }
  | { estado: 'aprobado'; plan: PlanIndividual | null }
  | { estado: 'rechazado' };

export function estadoRetorno(
  pagos: readonly PagoDoc[],
  sub: SuscripcionDoc | null,
  ahora: number
): EstadoRetorno {
  const reciente = [...pagos]
    .filter((p) => p.tipo !== 'reembolso' && ahora - p.creadoAt <= VENTANA_RETORNO_MS)
    .sort((a, b) => b.creadoAt - a.creadoAt)[0];
  if (reciente) {
    if (reciente.estado === 'aprobado') return { estado: 'aprobado', plan: reciente.plan };
    if (reciente.estado === 'rechazado') return { estado: 'rechazado' };
    return { estado: 'pendiente' };
  }
  // Sin pago visible todavía: si la suscripción ya arrancó un periodo pagado hace poco, listo.
  if (
    sub &&
    sub.estado === 'activa' &&
    sub.inicioPeriodo !== null &&
    ahora - sub.inicioPeriodo <= VENTANA_RETORNO_MS &&
    (sub.plan === 'piloto' || sub.plan === 'comandante')
  ) {
    return { estado: 'aprobado', plan: sub.plan };
  }
  return { estado: 'pendiente' };
}
