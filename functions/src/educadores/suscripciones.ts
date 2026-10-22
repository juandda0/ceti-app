/**
 * Servidor de cobros de Ceti Educadores: callables de la app del profe, webhook
 * de Wompi y ciclo diario de suscripciones. Toda la lógica del ciclo de vida es
 * del dominio (./dominio); aquí solo se lee, se llama a Wompi, se guarda y se
 * avisa. Toda escritura de `suscripciones/{uid}` pasa por `guardarSuscripcion`.
 *
 * Modelo (docs/educadores/modelo-datos.md):
 * - pagos/{referencia}: `PagoServidor` (el id del pago ES la referencia de Wompi).
 * - eventosPago/{txId_status}: idempotencia del webhook.
 * - fundadores/contador: { usados } — cupos de la tarifa fundador.
 *
 * El núcleo recibe sus dependencias (`Dependencias`) para poder probarlo sin
 * Firebase ni Wompi; los wrappers onCall/onRequest/onSchedule solo traducen.
 */
import { HttpsError, onCall, onRequest, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, getFirestore, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import {
  aplicarPagoAprobado,
  aplicarPagoRechazado,
  cancelar,
  cicloDiario,
  DIA_MS,
  ErrorSuscripcion,
  esCiclo,
  esPlanIndividual,
  finPausaSugerido,
  FUNDADOR,
  nuevaSuscripcion,
  PAUSA_MAX_DIAS,
  pausar,
  precioPlan,
  reanudar,
  revertirCancelacion,
  vigencia,
  type AccionCiclo,
  type Ciclo,
  type MetodoPago,
  type PlanIndividual,
  type Suscripcion,
} from './dominio';
import { COL_SUSCRIPCIONES, guardarSuscripcion, leerSuscripcion } from './plan';
import {
  aCentavos,
  clienteWompi,
  configWompi,
  ErrorWompi,
  esEstadoTransaccion,
  metodoDesdeWompi,
  SECRETOS_WOMPI,
  urlCheckout,
  verificarEvento,
  WOMPI_EVENTS_SECRET,
  WOMPI_INTEGRITY_SECRET,
  WOMPI_PUBLIC_KEY,
  type ClienteWompi,
  type EstadoTransaccion,
  type EventoWompi,
} from './wompi';
import { encolarCorreo, type DatosCorreo, type PlantillaCorreo } from './correo';
import { emitirFactura, SECRETOS_ALEGRA, type ClienteFactura, type PagoFacturable } from './facturacion';

export const COL_PAGOS = 'pagos';
export const COL_EVENTOS_PAGO = 'eventosPago';
export const DOC_FUNDADORES = 'fundadores/contador';

/** Buzón de operaciones (retractos y alertas de pago). */
export const CETI_OPS_EMAIL = defineString('CETI_OPS_EMAIL', { default: 'juandiegodiazave@gmail.com' });
/** A dónde vuelve el profe tras pagar en el Web Checkout. */
export const URL_RETORNO_PAGO = defineString('URL_RETORNO_PAGO', {
  default: 'https://ceti-d3769.web.app/pago',
});

/** Estados que revisa el ciclo diario ('gratis' no tiene nada que hacer). */
export const ESTADOS_CICLO = ['prueba', 'activa', 'en_mora', 'pausada', 'cancelada'] as const;

/** Un cobro recurrente pendiente más reciente que esto bloquea otro cobro (Nequi puede tardar). */
export const VENTANA_COBRO_PENDIENTE_MS = 3 * DIA_MS;

export type TipoPago = 'checkout' | 'recurrente' | 'reembolso';
export type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado' | 'reembolso_pendiente' | 'reembolsado';

/**
 * `pagos/{referencia}`. Los primeros campos son el `PagoDoc` que lee la app
 * (src/features/educadores/data/suscripcionRepository.ts); el resto es del servidor.
 */
export interface PagoServidor {
  uid: string;
  referencia: string;
  plan: PlanIndividual;
  ciclo: Ciclo;
  montoCop: number;
  estado: EstadoPago;
  metodo: MetodoPago | null;
  tipo: TipoPago;
  creadoAt: number;
  facturaUrl?: string | null;
  // ---- solo servidor ----
  email: string | null;
  /** Precio cotizado con tarifa fundador. */
  fundador: boolean;
  /** Cobro automático de un periodo nuevo del mismo plan (lo inicia el ciclo diario). */
  renovacion: boolean;
  fuentePagoId: string | null;
  wompiTxId: string | null;
  actualizadoAt: number;
  /** Reembolso: el pago que se devuelve. */
  pagoOriginalId?: string | null;
  reembolsoId?: string | null;
  finPeriodo?: number | null;
  aprobadoAt?: number | null;
  motivo?: string | null;
  alerta?: string | null;
}

export interface PerfilCorreo {
  email: string | null;
  nombre: string | null;
}

export interface Dependencias {
  db: Firestore;
  ahora(): number;
  /** Cliente de Wompi (lanza ErrorWompi 'no_configurado' al llamar si faltan llaves). */
  wompi(): ClienteWompi;
  llavePublica(): string;
  secretoIntegridad(): string;
  secretoEventos(): string;
  perfil(uid: string): Promise<PerfilCorreo>;
  correoOps(): string;
  facturar(pago: PagoFacturable, cliente: ClienteFactura): Promise<unknown>;
  urlRetorno(): string;
}

export function dependenciasReales(): Dependencias {
  const db = getFirestore();
  return {
    db,
    ahora: () => Date.now(),
    wompi: () => clienteWompi(configWompi()),
    llavePublica: () => WOMPI_PUBLIC_KEY.value(),
    secretoIntegridad: () => WOMPI_INTEGRITY_SECRET.value(),
    secretoEventos: () => WOMPI_EVENTS_SECRET.value(),
    perfil: async (uid) => {
      try {
        const u = await getAuth().getUser(uid);
        return { email: u.email ?? null, nombre: u.displayName ?? null };
      } catch {
        return { email: null, nombre: null };
      }
    },
    correoOps: () => CETI_OPS_EMAIL.value(),
    facturar: (pago, cliente) => emitirFactura(pago, cliente, { db }),
    urlRetorno: () => URL_RETORNO_PAGO.value(),
  };
}

// ---- utilidades puras ----

/** `ceti_<uid8>_<ms>` (lo pide el profe) o `ren_<uid8>_<ms>` (renovación automática). */
export function referenciaPago(prefijo: 'ceti' | 'ren', uid: string, ahora: number): string {
  return `${prefijo}_${uid.slice(0, 8)}_${ahora}`;
}

/**
 * ¿Este pago continúa el contrato fundador vigente? Refleja la regla de
 * `aplicarPagoAprobado`: mismo plan y ciclo, periodo vigente o en mora.
 */
export function conservaFundador(
  sub: Suscripcion | null,
  plan: PlanIndividual,
  ciclo: Ciclo,
  ahora: number
): boolean {
  if (!sub || !sub.fundador || plan !== 'piloto' || ciclo !== 'mensual') return false;
  if (sub.plan !== 'piloto' || sub.ciclo !== 'mensual' || sub.finPeriodo === null) return false;
  if (sub.estado === 'en_mora') return true;
  return (sub.estado === 'activa' || sub.estado === 'cancelada') && sub.finPeriodo > ahora;
}

/** Solo URLs https (o http de localhost en desarrollo); si no, la de por defecto. */
export function urlRetornoValida(valor: unknown, porDefecto: string): string {
  if (typeof valor !== 'string' || valor.length > 500) return porDefecto;
  try {
    const u = new URL(valor);
    if (u.protocol === 'https:') return u.toString();
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return u.toString();
  } catch {
    // cae a la de por defecto
  }
  return porDefecto;
}

/** Celular colombiano: 10 dígitos que empiezan por 3 (acepta +57 y espacios). */
export function normalizarCelular(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  let digitos = valor.replace(/\D/g, '');
  if (digitos.length === 12 && digitos.startsWith('57')) digitos = digitos.slice(2);
  return /^3\d{9}$/.test(digitos) ? digitos : null;
}

export type MedioSuscripcion = { tipo: 'NEQUI'; telefono: string } | { tipo: 'CARD'; token: string };

export function leerMedio(valor: unknown): MedioSuscripcion {
  const m = (valor ?? {}) as Record<string, unknown>;
  if (m.tipo === 'NEQUI') {
    const telefono = normalizarCelular(m.telefono);
    if (!telefono) throw new HttpsError('invalid-argument', 'El celular de Nequi no es válido.', { codigo: 'medio_invalido' });
    return { tipo: 'NEQUI', telefono };
  }
  if (m.tipo === 'CARD') {
    if (typeof m.token !== 'string' || !/^tok_[A-Za-z0-9_-]{1,200}$/.test(m.token)) {
      throw new HttpsError('invalid-argument', 'El token de la tarjeta no es válido.', { codigo: 'medio_invalido' });
    }
    return { tipo: 'CARD', token: m.token };
  }
  throw new HttpsError('invalid-argument', "El medio debe ser 'NEQUI' o 'CARD'.", { codigo: 'medio_invalido' });
}

export function leerPlanCiclo(data: unknown): { plan: PlanIndividual; ciclo: Ciclo } {
  const d = (data ?? {}) as Record<string, unknown>;
  if (!esPlanIndividual(d.plan)) {
    throw new HttpsError('invalid-argument', "El plan debe ser 'piloto' o 'comandante'.");
  }
  if (!esCiclo(d.ciclo)) throw new HttpsError('invalid-argument', "El ciclo debe ser 'mensual' o 'anioEscolar'.");
  return { plan: d.plan, ciclo: d.ciclo };
}

/** Errores de dominio y de Wompi → HttpsError. Lo demás es 'internal' (sin filtrar detalles). */
export function aHttps(e: unknown): never {
  if (e instanceof HttpsError) throw e;
  if (e instanceof ErrorSuscripcion) throw new HttpsError('failed-precondition', e.message, { codigo: e.codigo });
  if (e instanceof ErrorWompi) {
    switch (e.codigo) {
      case 'nequi_rechazado':
        throw new HttpsError('failed-precondition', 'La suscripción no se aprobó en Nequi.', { codigo: 'nequi_rechazado' });
      case 'nequi_sin_respuesta':
        throw new HttpsError('deadline-exceeded', 'No llegó la aprobación desde Nequi. Intenta de nuevo.', {
          codigo: 'nequi_sin_respuesta',
        });
      case 'no_configurado':
        throw new HttpsError('failed-precondition', 'Los pagos todavía no están activos.', { codigo: 'pagos_no_configurados' });
      default:
        if (e.status !== undefined && e.status >= 400 && e.status < 500) {
          throw new HttpsError('invalid-argument', 'Wompi no aceptó ese medio de pago.', { codigo: 'medio_invalido' });
        }
        throw new HttpsError('unavailable', 'La pasarela de pagos no respondió. Intenta de nuevo.', { codigo: 'pasarela' });
    }
  }
  console.error('educadores/suscripciones: error inesperado', e instanceof Error ? e.message : e);
  throw new HttpsError('internal', 'No pudimos completar la operación.');
}

function exigirProfe(auth: CallableRequest['auth']): { uid: string; email: string | null } {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (auth.token.role !== 'profesor') {
    throw new HttpsError('permission-denied', 'Solo los profes tienen plan de Ceti Educadores.');
  }
  return { uid: auth.uid, email: typeof auth.token.email === 'string' ? auth.token.email : null };
}

function refPago(db: Firestore, referencia: string) {
  return db.collection(COL_PAGOS).doc(referencia);
}

function nuevoPago(
  base: Pick<PagoServidor, 'uid' | 'referencia' | 'plan' | 'ciclo' | 'montoCop' | 'tipo' | 'email' | 'fundador'> &
    Partial<PagoServidor>,
  ahora: number
): PagoServidor {
  return {
    estado: 'pendiente',
    metodo: null,
    renovacion: false,
    fuentePagoId: null,
    wompiTxId: null,
    facturaUrl: null,
    creadoAt: ahora,
    actualizadoAt: ahora,
    ...base,
  };
}

// ---- cotización y checkout ----

export interface Cotizacion {
  montoCop: number;
  fundador: boolean;
  cuposFundador: number;
}

export async function cotizar(
  db: Firestore,
  uid: string,
  plan: PlanIndividual,
  ciclo: Ciclo,
  ahora: number
): Promise<Cotizacion> {
  const [sub, contador] = await Promise.all([leerSuscripcion(uid, undefined, db), db.doc(DOC_FUNDADORES).get()]);
  const usados = Number(contador.exists ? (contador.data()?.usados ?? 0) : 0);
  const cuposFundador = Math.max(0, FUNDADOR.cupos - usados);
  const fundador =
    conservaFundador(sub, plan, ciclo, ahora) || (plan === 'piloto' && ciclo === 'mensual' && cuposFundador > 0);
  return { montoCop: precioPlan(plan, ciclo, fundador), fundador, cuposFundador };
}

export interface ResultadoCheckout {
  url: string;
  referencia: string;
  montoCop: number;
  fundador: boolean;
}

export async function crearCheckout(
  deps: Dependencias,
  p: { uid: string; email: string | null; plan: PlanIndividual; ciclo: Ciclo; redirectUrl?: unknown }
): Promise<ResultadoCheckout> {
  const llave = deps.llavePublica();
  const secreto = deps.secretoIntegridad();
  if (!llave || !secreto) {
    throw new HttpsError('failed-precondition', 'Los pagos todavía no están activos.', { codigo: 'pagos_no_configurados' });
  }
  const ahora = deps.ahora();
  const cot = await cotizar(deps.db, p.uid, p.plan, p.ciclo, ahora);
  const referencia = referenciaPago('ceti', p.uid, ahora);
  const pago = nuevoPago(
    {
      uid: p.uid,
      referencia,
      plan: p.plan,
      ciclo: p.ciclo,
      montoCop: cot.montoCop,
      tipo: 'checkout',
      email: p.email,
      fundador: cot.fundador,
    },
    ahora
  );
  await refPago(deps.db, referencia).create(pago);
  const url = urlCheckout({
    llavePublica: llave,
    referencia,
    montoCop: cot.montoCop,
    secretoIntegridad: secreto,
    redirectUrl: urlRetornoValida(p.redirectUrl, deps.urlRetorno()),
    email: p.email,
  });
  return { url, referencia, montoCop: cot.montoCop, fundador: cot.fundador };
}

// ---- aplicar resultados de Wompi (idempotente: webhook, cobro inmediato y ciclo) ----

export interface ResultadoAplicacion {
  aplicado: boolean;
  motivo: string;
  pago: PagoServidor | null;
  sub: Suscripcion | null;
}

/**
 * Marca un pago como aprobado y aplica `aplicarPagoAprobado`, todo en una
 * transacción. Asigna la tarifa fundador de forma atómica. Si `eventoId` viene
 * (webhook), registra el evento para no procesarlo dos veces. Después encola la
 * factura y el recibo (fuera de la transacción).
 */
export async function aplicarAprobado(
  deps: Dependencias,
  p: { referencia: string; txId: string; metodoWompi?: string | null; montoCentavos?: number | null; eventoId?: string }
): Promise<ResultadoAplicacion> {
  const { db } = deps;
  const ahora = deps.ahora();
  const r = await db.runTransaction(async (tx): Promise<ResultadoAplicacion> => {
    const evRef = p.eventoId ? db.collection(COL_EVENTOS_PAGO).doc(p.eventoId) : null;
    if (evRef && (await tx.get(evRef)).exists) return { aplicado: false, motivo: 'duplicado', pago: null, sub: null };
    const marcar = (resultado: string) => {
      if (evRef) tx.set(evRef, { referencia: p.referencia, txId: p.txId, estado: 'APPROVED', resultado, recibidoAt: ahora });
    };

    const pagoRef = refPago(db, p.referencia);
    const pagoSnap = await tx.get(pagoRef);
    if (!pagoSnap.exists) {
      marcar('sin_pago');
      return { aplicado: false, motivo: 'sin_pago', pago: null, sub: null };
    }
    const pago = pagoSnap.data() as PagoServidor;
    if (pago.tipo === 'reembolso' || pago.estado === 'aprobado') {
      marcar('ya_aplicado');
      return { aplicado: false, motivo: 'ya_aplicado', pago, sub: null };
    }
    if (typeof p.montoCentavos === 'number' && p.montoCentavos !== aCentavos(pago.montoCop)) {
      tx.update(pagoRef, { alerta: 'monto_no_coincide', wompiTxId: p.txId, actualizadoAt: ahora });
      marcar('monto_no_coincide');
      return { aplicado: false, motivo: 'monto_no_coincide', pago, sub: null };
    }

    const sub = (await leerSuscripcion(pago.uid, tx, db)) ?? nuevaSuscripcion(pago.uid, ahora);
    // Tarifa fundador: se cuenta un cupo cuando un Piloto mensual pagado a precio
    // fundador entra por primera vez. El precio ya se cotizó con cupos libres, así
    // que se respeta aunque otro pago en vuelo haya tomado el último cupo.
    const nuevoFundador = pago.fundador && pago.plan === 'piloto' && pago.ciclo === 'mensual' && !sub.fundador;
    const contadorRef = db.doc(DOC_FUNDADORES);
    let usados = 0;
    if (nuevoFundador) {
      const c = await tx.get(contadorRef);
      usados = Number(c.exists ? (c.data()?.usados ?? 0) : 0);
    }

    const metodo: MetodoPago = p.metodoWompi ? metodoDesdeWompi(p.metodoWompi) : (pago.metodo ?? 'otro');
    const nueva = aplicarPagoAprobado(sub, {
      plan: pago.plan,
      ciclo: pago.ciclo,
      montoCop: pago.montoCop,
      fundador: pago.fundador,
      fuentePagoId: pago.fuentePagoId,
      metodo,
      ahora,
    });
    guardarSuscripcion(nueva, tx, db);
    if (nuevoFundador) {
      if (usados >= FUNDADOR.cupos) console.warn('aplicarAprobado: cupo fundador por encima del tope', { usados });
      tx.set(contadorRef, { usados: usados + 1, actualizadoAt: ahora }, { merge: true });
    }
    const cambios = {
      estado: 'aprobado' as const,
      metodo,
      wompiTxId: p.txId,
      aprobadoAt: ahora,
      actualizadoAt: ahora,
      finPeriodo: nueva.finPeriodo,
      alerta: null,
    };
    tx.update(pagoRef, cambios);
    marcar('aprobado');
    return { aplicado: true, motivo: 'aprobado', pago: { ...pago, ...cambios }, sub: nueva };
  });

  if (r.aplicado && r.pago) await efectosAprobado(deps, r.pago);
  return r;
}

async function efectosAprobado(deps: Dependencias, pago: PagoServidor): Promise<void> {
  const perfil = await deps.perfil(pago.uid);
  const email = pago.email ?? perfil.email;
  const tareas: Promise<unknown>[] = [
    deps.facturar(
      {
        id: pago.referencia,
        uid: pago.uid,
        referencia: pago.referencia,
        plan: pago.plan,
        ciclo: pago.ciclo,
        montoCop: pago.montoCop,
      },
      { email, nombre: perfil.nombre }
    ),
  ];
  if (email) {
    tareas.push(
      encolarCorreo(deps.db, {
        to: email,
        plantilla: 'recibo',
        datos: {
          nombre: perfil.nombre,
          plan: pago.plan,
          ciclo: pago.ciclo,
          montoCop: pago.montoCop,
          referencia: pago.referencia,
          fecha: pago.aprobadoAt ?? deps.ahora(),
          finPeriodo: pago.finPeriodo ?? null,
        },
      })
    );
  }
  const resultados = await Promise.allSettled(tareas);
  for (const res of resultados) {
    if (res.status === 'rejected') {
      console.error('efectosAprobado: falló la factura o el recibo', { referencia: pago.referencia });
    }
  }
}

/**
 * Marca un pago pendiente como rechazado. Si era una renovación automática,
 * aplica `aplicarPagoRechazado` (mora con reintentos) y, con `avisar`, envía el
 * correo 'pago_rechazado'. Idempotente: solo actúa sobre pagos 'pendiente'.
 */
export async function aplicarRechazado(
  deps: Dependencias,
  p: {
    referencia: string;
    txId: string | null;
    estadoWompi: EstadoTransaccion;
    eventoId?: string;
    avisar: boolean;
    motivo?: string;
  }
): Promise<ResultadoAplicacion> {
  const { db } = deps;
  const ahora = deps.ahora();
  const r = await db.runTransaction(async (tx): Promise<ResultadoAplicacion> => {
    const evRef = p.eventoId ? db.collection(COL_EVENTOS_PAGO).doc(p.eventoId) : null;
    if (evRef && (await tx.get(evRef)).exists) return { aplicado: false, motivo: 'duplicado', pago: null, sub: null };
    const marcar = (resultado: string) => {
      if (evRef) tx.set(evRef, { referencia: p.referencia, txId: p.txId, estado: p.estadoWompi, resultado, recibidoAt: ahora });
    };

    const pagoRef = refPago(db, p.referencia);
    const pagoSnap = await tx.get(pagoRef);
    if (!pagoSnap.exists) {
      marcar('sin_pago');
      return { aplicado: false, motivo: 'sin_pago', pago: null, sub: null };
    }
    const pago = pagoSnap.data() as PagoServidor;
    if (pago.estado !== 'pendiente') {
      if (pago.estado === 'aprobado' && p.estadoWompi === 'VOIDED') {
        // Anulación después de aprobar: no se quita el plan solo; lo revisa operaciones.
        tx.update(pagoRef, { alerta: 'anulada_tras_aprobar', actualizadoAt: ahora });
        console.warn('aplicarRechazado: transacción anulada tras aprobar', { referencia: p.referencia });
      }
      marcar('sin_cambio');
      return { aplicado: false, motivo: 'sin_cambio', pago, sub: null };
    }

    const sub = pago.renovacion ? await leerSuscripcion(pago.uid, tx, db) : null;
    const cambios = {
      estado: 'rechazado' as const,
      wompiTxId: p.txId ?? pago.wompiTxId,
      motivo: p.motivo ?? p.estadoWompi,
      actualizadoAt: ahora,
    };
    tx.update(pagoRef, cambios);
    let nueva: Suscripcion | null = null;
    // Solo si la suscripción sigue esperando ese cobro (no la canceló ni cambió de plan).
    if (
      sub &&
      (sub.estado === 'activa' || sub.estado === 'en_mora') &&
      sub.plan === pago.plan &&
      sub.ciclo === pago.ciclo
    ) {
      nueva = aplicarPagoRechazado(sub, ahora);
      guardarSuscripcion(nueva, tx, db);
    }
    marcar('rechazado');
    return { aplicado: true, motivo: 'rechazado', pago: { ...pago, ...cambios }, sub: nueva };
  });

  if (r.aplicado && r.sub && r.pago && p.avisar) {
    try {
      const perfil = await deps.perfil(r.pago.uid);
      const email = r.pago.email ?? perfil.email;
      if (email) {
        await encolarCorreo(deps.db, {
          to: email,
          plantilla: 'pago_rechazado',
          datos: { nombre: perfil.nombre, plan: r.pago.plan, ciclo: r.pago.ciclo, montoCop: r.pago.montoCop, fecha: ahora },
        });
      }
    } catch {
      console.error('aplicarRechazado: no se pudo encolar el aviso', { referencia: p.referencia });
    }
  }
  return r;
}

// ---- webhook ----

/** Procesa un evento de Wompi. Devuelve el status HTTP (401 si la firma no cuadra). */
export async function procesarEventoWompi(
  deps: Dependencias,
  body: unknown
): Promise<{ status: number; resultado: string }> {
  if (!verificarEvento(body, deps.secretoEventos())) return { status: 401, resultado: 'firma_invalida' };
  const ev = body as EventoWompi;
  if (ev.event !== 'transaction.updated') return { status: 200, resultado: 'ignorado' };
  const t = (ev.data?.transaction ?? null) as Record<string, unknown> | null;
  const txId = t?.id;
  const estado = t?.status;
  const referencia = t?.reference;
  if (typeof txId !== 'string' || typeof referencia !== 'string' || !esEstadoTransaccion(estado)) {
    return { status: 200, resultado: 'incompleto' };
  }
  const eventoId = `${txId}_${estado}`;
  if (estado === 'APPROVED') {
    const r = await aplicarAprobado(deps, {
      referencia,
      txId,
      metodoWompi: typeof t?.payment_method_type === 'string' ? t.payment_method_type : null,
      montoCentavos: typeof t?.amount_in_cents === 'number' ? t.amount_in_cents : null,
      eventoId,
    });
    return { status: 200, resultado: r.motivo };
  }
  if (estado === 'DECLINED' || estado === 'ERROR' || estado === 'VOIDED') {
    const r = await aplicarRechazado(deps, { referencia, txId, estadoWompi: estado, eventoId, avisar: true });
    return { status: 200, resultado: r.motivo };
  }
  return { status: 200, resultado: 'pendiente' };
}

// ---- suscripción con cobro automático ----

export async function suscribir(
  deps: Dependencias,
  p: { uid: string; email: string | null; plan: PlanIndividual; ciclo: Ciclo; medio: MedioSuscripcion }
): Promise<{ ok: true; referencia: string }> {
  if (!p.email) {
    throw new HttpsError('failed-precondition', 'Tu cuenta necesita un correo para el cobro automático.', {
      codigo: 'sin_correo',
    });
  }
  const { db } = deps;
  const wompi = deps.wompi();
  const aceptacion = await wompi.tokenAceptacion();
  const token = p.medio.tipo === 'NEQUI' ? await wompi.tokenNequi(p.medio.telefono) : p.medio.token;
  const fuente = await wompi.crearFuentePago({ tipo: p.medio.tipo, token, email: p.email, aceptacion });
  const metodo: MetodoPago = p.medio.tipo === 'CARD' ? 'tarjeta' : 'nequi';

  const ahora = deps.ahora();
  await db.runTransaction(async (tx) => {
    const sub = (await leerSuscripcion(p.uid, tx, db)) ?? nuevaSuscripcion(p.uid, ahora);
    guardarSuscripcion({ ...sub, fuentePagoId: fuente.id, metodo }, tx, db);
  });

  const cot = await cotizar(db, p.uid, p.plan, p.ciclo, ahora);
  const referencia = referenciaPago('ceti', p.uid, ahora);
  await refPago(db, referencia).create(
    nuevoPago(
      {
        uid: p.uid,
        referencia,
        plan: p.plan,
        ciclo: p.ciclo,
        montoCop: cot.montoCop,
        tipo: 'recurrente',
        email: p.email,
        fundador: cot.fundador,
        fuentePagoId: fuente.id,
        metodo,
      },
      ahora
    )
  );

  let tx;
  try {
    tx = await wompi.cobrarConFuente({ fuentePagoId: fuente.id, referencia, montoCop: cot.montoCop, email: p.email });
  } catch (e) {
    await aplicarRechazado(deps, { referencia, txId: null, estadoWompi: 'ERROR', avisar: false, motivo: 'sin_respuesta' });
    throw e;
  }
  await refPago(db, referencia).update({ wompiTxId: tx.id, actualizadoAt: deps.ahora() });

  if (tx.estado === 'APPROVED') {
    await aplicarAprobado(deps, { referencia, txId: tx.id, metodoWompi: tx.metodo ?? p.medio.tipo });
  } else if (tx.estado !== 'PENDING') {
    await aplicarRechazado(deps, { referencia, txId: tx.id, estadoWompi: tx.estado, avisar: false });
    throw new HttpsError('failed-precondition', 'El pago no se aprobó. Prueba con otro medio.', {
      codigo: 'pago_rechazado',
      referencia,
    });
  }
  return { ok: true, referencia };
}

// ---- gestionar (pausar, reanudar, cancelar, revertir) ----

export type AccionSuscripcion = 'pausar' | 'reanudar' | 'cancelar' | 'revertirCancelacion';
const ACCIONES: readonly AccionSuscripcion[] = ['pausar', 'reanudar', 'cancelar', 'revertirCancelacion'];

export function esAccion(v: unknown): v is AccionSuscripcion {
  return typeof v === 'string' && (ACCIONES as readonly string[]).includes(v);
}

export interface ResultadoGestion {
  ok: true;
  estado: Suscripcion['estado'];
  reembolso: boolean;
  accesoHasta: number | null;
}

export async function gestionar(
  deps: Dependencias,
  p: { uid: string; email: string | null; accion: AccionSuscripcion; hasta?: number | null }
): Promise<ResultadoGestion> {
  const { db } = deps;
  const ahora = deps.ahora();
  const r = await db.runTransaction(async (tx) => {
    const sub = await leerSuscripcion(p.uid, tx, db);
    if (!sub) throw new ErrorSuscripcion('sin_plan_pago', 'No tienes un plan que gestionar.');
    let nueva: Suscripcion;
    let reembolso = false;
    let accesoHasta: number | null = null;
    let cobrarAhora = false;
    switch (p.accion) {
      case 'pausar': {
        const hasta =
          typeof p.hasta === 'number' && Number.isFinite(p.hasta)
            ? p.hasta
            : Math.min(finPausaSugerido(ahora), ahora + PAUSA_MAX_DIAS * DIA_MS);
        nueva = pausar(sub, hasta, ahora);
        break;
      }
      case 'reanudar': {
        const res = reanudar(sub, ahora);
        nueva = res.sub;
        cobrarAhora = res.cobrarAhora;
        break;
      }
      case 'cancelar': {
        const res = cancelar(sub, ahora);
        nueva = res.sub;
        reembolso = res.reembolsar;
        accesoHasta = res.accesoHasta;
        break;
      }
      case 'revertirCancelacion':
        nueva = revertirCancelacion(sub, ahora);
        break;
    }
    guardarSuscripcion(nueva, tx, db);
    if (p.accion !== 'cancelar') {
      const v = vigencia(nueva);
      accesoHasta = v.hasta > ahora ? v.hasta : null;
    }
    return { sub: nueva, reembolso, accesoHasta, cobrarAhora };
  });

  if (r.reembolso) await registrarReembolso(deps, p.uid, p.email, ahora);
  // Volvió de la pausa sin días congelados: el periodo nuevo se cobra ya.
  if (r.cobrarAhora) await procesarSuscripcion(deps, p.uid);
  return { ok: true, estado: r.sub.estado, reembolso: r.reembolso, accesoHasta: r.accesoHasta };
}

/**
 * Retracto: crea el pago de reembolso del último pago aprobado y avisa a
 * operaciones. Wompi no expone devoluciones por API para este flujo: se hacen a
 * mano desde su panel (docs/educadores/operacion.md).
 */
async function registrarReembolso(deps: Dependencias, uid: string, email: string | null, ahora: number) {
  const { db } = deps;
  const snap = await db.collection(COL_PAGOS).where('uid', '==', uid).orderBy('creadoAt', 'desc').limit(20).get();
  const original = snap.docs
    .map((d) => d.data() as PagoServidor)
    .find((pg) => pg.estado === 'aprobado' && pg.tipo !== 'reembolso');
  let reembolso: PagoServidor | null = null;
  if (original) {
    const id = `dev_${original.referencia}`;
    reembolso = nuevoPago(
      {
        uid,
        referencia: id,
        plan: original.plan,
        ciclo: original.ciclo,
        montoCop: original.montoCop,
        tipo: 'reembolso',
        email: original.email ?? email,
        fundador: original.fundador,
        estado: 'reembolso_pendiente',
        metodo: original.metodo,
        pagoOriginalId: original.referencia,
        wompiTxId: original.wompiTxId,
      },
      ahora
    );
    try {
      await refPago(db, id).create(reembolso);
    } catch {
      // Ya existía (doble toque): no se duplica.
      return;
    }
    await refPago(db, original.referencia).update({ reembolsoId: id, actualizadoAt: ahora });
  } else {
    console.warn('registrarReembolso: no se encontró el pago a devolver', { uid });
  }
  try {
    await encolarCorreo(db, {
      to: deps.correoOps(),
      plantilla: 'reembolso_ops',
      datos: {
        uid,
        email: reembolso?.email ?? email,
        pagoId: reembolso?.referencia ?? null,
        referencia: original?.referencia ?? null,
        wompiTxId: original?.wompiTxId ?? null,
        montoCop: original?.montoCop ?? null,
        plan: original?.plan ?? null,
        ciclo: original?.ciclo ?? null,
        metodo: original?.metodo ?? null,
        fecha: ahora,
      },
    });
  } catch {
    console.error('registrarReembolso: no se pudo avisar a operaciones', { uid });
  }
}

// ---- ciclo diario ----

/** Corre el ciclo diario de una suscripción y ejecuta sus acciones. */
export async function procesarSuscripcion(deps: Dependencias, uid: string): Promise<AccionCiclo[]> {
  const { db } = deps;
  const ahora = deps.ahora();
  const res = await db.runTransaction(async (tx) => {
    const sub = await leerSuscripcion(uid, tx, db);
    if (!sub) return null;
    const r = cicloDiario(sub, ahora);
    if (r.sub !== sub) guardarSuscripcion(r.sub, tx, db);
    return r;
  });
  if (!res) return [];
  for (const accion of res.acciones) {
    switch (accion.tipo) {
      case 'cobrar':
        await cobrarRenovacion(deps, res.sub, accion, ahora);
        break;
      case 'aviso':
        await enviarAviso(deps, res.sub, accion.plantilla, accion.fecha);
        break;
      case 'degradado':
        console.info('cicloSuscripciones: pasa a Cadete', { uid, motivo: accion.motivo });
        break;
      case 'reanudada':
        break;
    }
  }
  return res.acciones;
}

async function hayCobroPendiente(db: Firestore, uid: string, ahora: number): Promise<boolean> {
  const snap = await db.collection(COL_PAGOS).where('uid', '==', uid).orderBy('creadoAt', 'desc').limit(5).get();
  return snap.docs.some((d) => {
    const pg = d.data() as PagoServidor;
    return pg.tipo === 'recurrente' && pg.estado === 'pendiente' && pg.creadoAt > ahora - VENTANA_COBRO_PENDIENTE_MS;
  });
}

async function cobrarRenovacion(
  deps: Dependencias,
  sub: Suscripcion,
  accion: Extract<AccionCiclo, { tipo: 'cobrar' }>,
  ahora: number
): Promise<void> {
  const { db } = deps;
  if (!sub.fuentePagoId) return;
  if (await hayCobroPendiente(db, sub.uid, ahora)) {
    console.info('cicloSuscripciones: ya hay un cobro en curso', { uid: sub.uid });
    return;
  }
  const perfil = await deps.perfil(sub.uid);
  if (!perfil.email) throw new Error('La cuenta no tiene correo para el cobro.');
  const referencia = referenciaPago('ren', sub.uid, ahora);
  await refPago(db, referencia).create(
    nuevoPago(
      {
        uid: sub.uid,
        referencia,
        plan: accion.plan,
        ciclo: accion.ciclo,
        montoCop: accion.montoCop,
        tipo: 'recurrente',
        email: perfil.email,
        fundador: sub.fundador,
        renovacion: true,
        fuentePagoId: sub.fuentePagoId,
        metodo: sub.metodo,
      },
      ahora
    )
  );
  let tx;
  try {
    tx = await deps.wompi().cobrarConFuente({
      fuentePagoId: sub.fuentePagoId,
      referencia,
      montoCop: accion.montoCop,
      email: perfil.email,
    });
  } catch (e) {
    // Sin respuesta o fuente revocada: cuenta como rechazo (mora con reintentos y
    // 7 días de gracia). Si Wompi sí lo cobró, el webhook APPROVED lo arregla.
    const rechazoReal = e instanceof ErrorWompi && e.status !== undefined && e.status >= 400 && e.status < 500;
    await aplicarRechazado(deps, {
      referencia,
      txId: null,
      estadoWompi: 'ERROR',
      avisar: rechazoReal,
      motivo: rechazoReal ? 'fuente_rechazada' : 'sin_respuesta',
    });
    return;
  }
  await refPago(db, referencia).update({ wompiTxId: tx.id, actualizadoAt: deps.ahora() });
  if (tx.estado === 'APPROVED') {
    await aplicarAprobado(deps, { referencia, txId: tx.id, metodoWompi: tx.metodo });
  } else if (tx.estado !== 'PENDING') {
    await aplicarRechazado(deps, { referencia, txId: tx.id, estadoWompi: tx.estado, avisar: true });
  }
}

async function enviarAviso(deps: Dependencias, sub: Suscripcion, plantilla: PlantillaCorreo, fecha: number) {
  const perfil = await deps.perfil(sub.uid);
  if (!perfil.email) return;
  const datos: DatosCorreo = {
    nombre: perfil.nombre,
    fecha,
    plan: sub.plan,
    ciclo: sub.ciclo,
    montoCop: sub.precioCop,
  };
  await encolarCorreo(deps.db, { to: perfil.email, plantilla, datos });
}

/** Recorre, paginando, las suscripciones con algo que hacer. Un error no detiene el recorrido. */
export async function correrCiclo(
  deps: Dependencias,
  tamPagina = 200
): Promise<{ revisadas: number; errores: number }> {
  let ultimo: DocumentSnapshot | null = null;
  let revisadas = 0;
  let errores = 0;
  for (;;) {
    let q = deps.db
      .collection(COL_SUSCRIPCIONES)
      .where('estado', 'in', [...ESTADOS_CICLO])
      .orderBy(FieldPath.documentId())
      .limit(tamPagina);
    if (ultimo) q = q.startAfter(ultimo);
    const snap = await q.get();
    for (const d of snap.docs) {
      revisadas += 1;
      try {
        await procesarSuscripcion(deps, d.id);
      } catch (e) {
        errores += 1;
        console.error('cicloSuscripciones: falló una suscripción', {
          uid: d.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (snap.docs.length < tamPagina) break;
    ultimo = snap.docs[snap.docs.length - 1];
  }
  return { revisadas, errores };
}

// ---- Cloud Functions ----

const SECRETOS_COBRO = [...SECRETOS_WOMPI, ...SECRETOS_ALEGRA];

/** Precio que vería hoy el profe (aplica tarifa fundador si quedan cupos). */
export const cotizarPlan = onCall(async (request) => {
  const { uid } = exigirProfe(request.auth);
  const { plan, ciclo } = leerPlanCiclo(request.data);
  try {
    return await cotizar(getFirestore(), uid, plan, ciclo, Date.now());
  } catch (e) {
    aHttps(e);
  }
});

/** Pago único por Wompi Web Checkout: crea `pagos/{ref}` pendiente y devuelve la URL. */
export const crearCheckoutPlan = onCall({ secrets: [WOMPI_INTEGRITY_SECRET] }, async (request) => {
  const { uid, email } = exigirProfe(request.auth);
  const { plan, ciclo } = leerPlanCiclo(request.data);
  const redirectUrl = (request.data as Record<string, unknown> | null)?.redirectUrl;
  try {
    return await crearCheckout(dependenciasReales(), { uid, email, plan, ciclo, redirectUrl });
  } catch (e) {
    aHttps(e);
  }
});

/** Cobro automático con Nequi o tarjeta tokenizada. Nequi espera la aprobación en la app (hasta ~60 s). */
export const suscribirConMedio = onCall({ secrets: SECRETOS_COBRO, timeoutSeconds: 120 }, async (request) => {
  const { uid, email } = exigirProfe(request.auth);
  const { plan, ciclo } = leerPlanCiclo(request.data);
  const medio = leerMedio((request.data as Record<string, unknown> | null)?.medio);
  try {
    return await suscribir(dependenciasReales(), { uid, email, plan, ciclo, medio });
  } catch (e) {
    aHttps(e);
  }
});

export const gestionarSuscripcion = onCall({ secrets: SECRETOS_COBRO }, async (request) => {
  const { uid, email } = exigirProfe(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  if (!esAccion(data.accion)) {
    throw new HttpsError('invalid-argument', "La acción debe ser 'pausar', 'reanudar', 'cancelar' o 'revertirCancelacion'.");
  }
  const hasta = typeof data.hasta === 'number' ? data.hasta : null;
  try {
    return await gestionar(dependenciasReales(), { uid, email, accion: data.accion, hasta });
  } catch (e) {
    aHttps(e);
  }
});

/** Webhook de eventos de Wompi (URL en docs/educadores/operacion.md). */
export const wompiEventos = onRequest({ secrets: SECRETOS_COBRO }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  try {
    const r = await procesarEventoWompi(dependenciasReales(), req.body);
    res.status(r.status).json({ ok: r.status === 200, resultado: r.resultado });
  } catch (e) {
    // 500 → Wompi reintenta; el procesamiento es idempotente.
    console.error('wompiEventos: fallo', e instanceof Error ? e.message : String(e));
    res.status(500).json({ ok: false });
  }
});

export const cicloSuscripciones = onSchedule(
  { schedule: 'every day 06:00', timeZone: 'America/Bogota', secrets: SECRETOS_COBRO, timeoutSeconds: 540 },
  async () => {
    const r = await correrCiclo(dependenciasReales());
    console.info('cicloSuscripciones: listo', r);
  }
);
