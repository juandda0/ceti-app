/**
 * Adaptador de Wompi (pasarela de pagos de Bancolombia) para los cobros de Ceti
 * Educadores. Las funciones puras (firma de integridad, URL del Web Checkout,
 * verificación de eventos) no tocan red; el cliente de red recibe `fetch`
 * inyectable para poder probarlo sin llamar a Wompi.
 *
 * Montos: Ceti trabaja en COP entero; Wompi recibe centavos (×100).
 * Nunca registrar en logs tokens, datos de tarjeta, teléfonos ni secretos.
 *
 * Referencias: docs.wompi.co (Web Checkout, fuentes de pago, eventos).
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';

// ---- configuración ----

export const WOMPI_PUBLIC_KEY = defineString('WOMPI_PUBLIC_KEY', { default: '' });
export const WOMPI_ENV = defineString('WOMPI_ENV', { default: 'sandbox' });
export const WOMPI_PRIVATE_KEY = defineSecret('WOMPI_PRIVATE_KEY');
export const WOMPI_INTEGRITY_SECRET = defineSecret('WOMPI_INTEGRITY_SECRET');
export const WOMPI_EVENTS_SECRET = defineSecret('WOMPI_EVENTS_SECRET');

/** Secretos de Wompi que deben declarar las funciones que cobran o verifican eventos. */
export const SECRETOS_WOMPI = [WOMPI_PRIVATE_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET];

export type EntornoWompi = 'sandbox' | 'production';

export const API_WOMPI: Record<EntornoWompi, string> = {
  sandbox: 'https://sandbox.wompi.co/v1',
  production: 'https://production.wompi.co/v1',
};

export const URL_CHECKOUT = 'https://checkout.wompi.co/p/';

export const MONEDA = 'COP';

export function entornoWompi(valor: string): EntornoWompi {
  return valor === 'production' ? 'production' : 'sandbox';
}

export function aCentavos(montoCop: number): number {
  return Math.round(montoCop) * 100;
}

// ---- funciones puras ----

function sha256(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

/** Firma de integridad: sha256(referencia + montoCentavos + moneda + secreto), en hex. */
export function firmaIntegridad(
  referencia: string,
  montoCentavos: number,
  moneda: string,
  secreto: string
): string {
  return sha256(`${referencia}${montoCentavos}${moneda}${secreto}`);
}

export interface ParametrosCheckout {
  llavePublica: string;
  referencia: string;
  montoCop: number;
  secretoIntegridad: string;
  redirectUrl?: string | null;
  email?: string | null;
}

/** URL del Web Checkout de Wompi (pago único: tarjeta, PSE, Nequi, Bancolombia). */
export function urlCheckout(p: ParametrosCheckout): string {
  const centavos = aCentavos(p.montoCop);
  const params = new URLSearchParams();
  params.set('public-key', p.llavePublica);
  params.set('currency', MONEDA);
  params.set('amount-in-cents', String(centavos));
  params.set('reference', p.referencia);
  params.set('signature:integrity', firmaIntegridad(p.referencia, centavos, MONEDA, p.secretoIntegridad));
  if (p.redirectUrl) params.set('redirect-url', p.redirectUrl);
  if (p.email) params.set('customer-data:email', p.email);
  return `${URL_CHECKOUT}?${params.toString()}`;
}

export interface EventoWompi {
  event?: string;
  data?: Record<string, unknown>;
  environment?: string;
  signature?: { properties?: unknown; checksum?: unknown };
  timestamp?: number | string;
  sent_at?: string;
}

function valorEnRuta(raiz: unknown, ruta: string): unknown {
  let actual: unknown = raiz;
  for (const parte of ruta.split('.')) {
    if (actual === null || typeof actual !== 'object') return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

/**
 * Verifica la firma de un evento de Wompi: concatena los valores de `data` en
 * las rutas de `signature.properties`, luego `timestamp` y el secreto de
 * eventos; el sha256 debe coincidir con `signature.checksum` (tiempo constante).
 */
export function verificarEvento(body: unknown, secreto: string): boolean {
  if (!secreto || body === null || typeof body !== 'object') return false;
  const ev = body as EventoWompi;
  const props = ev.signature?.properties;
  const checksum = ev.signature?.checksum;
  if (!Array.isArray(props) || typeof checksum !== 'string' || ev.timestamp === undefined) return false;
  let cadena = '';
  for (const ruta of props) {
    if (typeof ruta !== 'string') return false;
    const v = valorEnRuta(ev.data, ruta);
    if (v === undefined || v === null || typeof v === 'object') return false;
    cadena += String(v);
  }
  cadena += String(ev.timestamp) + secreto;
  const esperado = Buffer.from(sha256(cadena), 'utf8');
  const recibido = Buffer.from(checksum.toLowerCase(), 'utf8');
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

// ---- cliente de red ----

export type EstadoTransaccion = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

export type FetchWompi = (url: string, init?: RequestInit) => Promise<Response>;

export interface ConfigWompi {
  entorno: EntornoWompi;
  llavePublica: string;
  llavePrivada: string;
  secretoIntegridad: string;
  fetch?: FetchWompi;
  /** Espera entre consultas del token Nequi (inyectable para tests). */
  esperar?: (ms: number) => Promise<void>;
  /** Cuánto esperar a que el profe apruebe en su app Nequi. */
  esperaNequiMs?: number;
  intervaloNequiMs?: number;
}

export class ErrorWompi extends Error {
  constructor(
    public readonly codigo:
      | 'no_configurado'
      | 'http'
      | 'respuesta_invalida'
      | 'nequi_rechazado'
      | 'nequi_sin_respuesta',
    mensaje: string,
    public readonly status?: number
  ) {
    super(mensaje);
    this.name = 'ErrorWompi';
  }
}

export interface Aceptacion {
  acceptanceToken: string;
  /** Autorización de tratamiento de datos personales (Wompi la pide desde 2024). */
  personalAuthToken: string | null;
}

export interface FuentePago {
  id: string;
  estado: string;
}

export interface Transaccion {
  id: string;
  estado: EstadoTransaccion;
  metodo: string | null;
}

export interface ClienteWompi {
  tokenAceptacion(): Promise<Aceptacion>;
  /** Tokeniza un Nequi y espera hasta ~60 s a que el profe apruebe en su app. Devuelve el id del token. */
  tokenNequi(telefono: string): Promise<string>;
  crearFuentePago(p: {
    tipo: 'CARD' | 'NEQUI';
    token: string;
    email: string;
    aceptacion: Aceptacion;
  }): Promise<FuentePago>;
  cobrarConFuente(p: {
    fuentePagoId: string;
    referencia: string;
    montoCop: number;
    email: string;
  }): Promise<Transaccion>;
}

const ESTADOS_TX: readonly EstadoTransaccion[] = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'];

export function esEstadoTransaccion(v: unknown): v is EstadoTransaccion {
  return typeof v === 'string' && (ESTADOS_TX as readonly string[]).includes(v);
}

function esperarReal(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function clienteWompi(cfg: ConfigWompi): ClienteWompi {
  const base = API_WOMPI[cfg.entorno];
  const f: FetchWompi = cfg.fetch ?? ((url, init) => fetch(url, init));
  const esperar = cfg.esperar ?? esperarReal;
  const esperaNequi = cfg.esperaNequiMs ?? 60_000;
  const intervalo = cfg.intervaloNequiMs ?? 3_000;

  async function llamar(
    metodo: 'GET' | 'POST',
    ruta: string,
    llave: string,
    cuerpo?: unknown
  ): Promise<Record<string, unknown>> {
    if (!llave) throw new ErrorWompi('no_configurado', 'Wompi no está configurado.');
    const resp = await f(`${base}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${llave}`,
        ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    let json: unknown = null;
    try {
      json = await resp.json();
    } catch {
      json = null;
    }
    if (!resp.ok) {
      // Solo el tipo de error; el cuerpo puede repetir datos del pagador.
      const tipo = (json as { error?: { type?: unknown } } | null)?.error?.type;
      throw new ErrorWompi('http', `Wompi respondió ${resp.status}${typeof tipo === 'string' ? ` (${tipo})` : ''}.`, resp.status);
    }
    const data = (json as { data?: unknown } | null)?.data;
    if (data === null || typeof data !== 'object') {
      throw new ErrorWompi('respuesta_invalida', 'Wompi respondió sin datos.');
    }
    return data as Record<string, unknown>;
  }

  return {
    async tokenAceptacion() {
      const data = await llamar('GET', `/merchants/${cfg.llavePublica}`, cfg.llavePublica);
      const acceptance = (data.presigned_acceptance as { acceptance_token?: unknown } | undefined)?.acceptance_token;
      if (typeof acceptance !== 'string') {
        throw new ErrorWompi('respuesta_invalida', 'Wompi no devolvió el token de aceptación.');
      }
      const personal = (data.presigned_personal_data_auth as { acceptance_token?: unknown } | undefined)
        ?.acceptance_token;
      return { acceptanceToken: acceptance, personalAuthToken: typeof personal === 'string' ? personal : null };
    },

    async tokenNequi(telefono) {
      const creado = await llamar('POST', '/tokens/nequi', cfg.llavePublica, { phone_number: telefono });
      const id = creado.id;
      if (typeof id !== 'string') throw new ErrorWompi('respuesta_invalida', 'Wompi no devolvió el token Nequi.');
      let estado = creado.status;
      const limite = esperaNequi;
      let esperado = 0;
      while (estado !== 'APPROVED') {
        if (estado === 'DECLINED' || estado === 'ERROR') {
          throw new ErrorWompi('nequi_rechazado', 'La suscripción no se aprobó en Nequi.');
        }
        if (esperado >= limite) {
          throw new ErrorWompi('nequi_sin_respuesta', 'No llegó la aprobación desde Nequi.');
        }
        await esperar(intervalo);
        esperado += intervalo;
        const consulta = await llamar('GET', `/tokens/nequi/${encodeURIComponent(id)}`, cfg.llavePublica);
        estado = consulta.status;
      }
      return id;
    },

    async crearFuentePago({ tipo, token, email, aceptacion }) {
      const data = await llamar('POST', '/payment_sources', cfg.llavePrivada, {
        type: tipo,
        token,
        customer_email: email,
        acceptance_token: aceptacion.acceptanceToken,
        ...(aceptacion.personalAuthToken ? { accept_personal_auth: aceptacion.personalAuthToken } : {}),
      });
      if (data.id === undefined || data.id === null) {
        throw new ErrorWompi('respuesta_invalida', 'Wompi no devolvió la fuente de pago.');
      }
      return { id: String(data.id), estado: String(data.status ?? '') };
    },

    async cobrarConFuente({ fuentePagoId, referencia, montoCop, email }) {
      const centavos = aCentavos(montoCop);
      const fuente = Number(fuentePagoId);
      const data = await llamar('POST', '/transactions', cfg.llavePrivada, {
        amount_in_cents: centavos,
        currency: MONEDA,
        signature: firmaIntegridad(referencia, centavos, MONEDA, cfg.secretoIntegridad),
        customer_email: email,
        payment_method: { installments: 1 },
        reference: referencia,
        payment_source_id: Number.isFinite(fuente) ? fuente : fuentePagoId,
      });
      if (typeof data.id !== 'string' || !esEstadoTransaccion(data.status)) {
        throw new ErrorWompi('respuesta_invalida', 'Wompi devolvió una transacción sin id o estado.');
      }
      return {
        id: data.id,
        estado: data.status,
        metodo: typeof data.payment_method_type === 'string' ? data.payment_method_type : null,
      };
    },
  };
}

/** Configuración desde los parámetros de Functions (solo dentro de una función que declare SECRETOS_WOMPI). */
export function configWompi(): ConfigWompi {
  return {
    entorno: entornoWompi(WOMPI_ENV.value()),
    llavePublica: WOMPI_PUBLIC_KEY.value(),
    llavePrivada: WOMPI_PRIVATE_KEY.value(),
    secretoIntegridad: WOMPI_INTEGRITY_SECRET.value(),
  };
}

/** Tipo de medio de Wompi → `MetodoPago` del dominio. */
export function metodoDesdeWompi(tipo: string | null | undefined): 'tarjeta' | 'nequi' | 'pse' | 'bre_b' | 'otro' {
  switch (tipo) {
    case 'CARD':
      return 'tarjeta';
    case 'NEQUI':
      return 'nequi';
    case 'PSE':
      return 'pse';
    default:
      return tipo && tipo.toUpperCase().includes('BRE') ? 'bre_b' : 'otro';
  }
}
