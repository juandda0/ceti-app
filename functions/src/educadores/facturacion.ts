/**
 * Factura electrónica de cada pago aprobado. Siempre deja `facturas/{pagoId}`
 * en Firestore; si Alegra está configurado, la emite ahí (Alegra transmite a la
 * DIAN y le envía el PDF al profe). Si algo falla, la factura queda 'pendiente'
 * con el error para emitirla a mano (docs/educadores/operacion.md).
 *
 * El precio de los planes ya incluye el IVA del 19 %: aquí se separa la base.
 * IVA pendiente de confirmar con un tributarista (ver dominio/precios.ts).
 */
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { desgloseIvaIncluido, fechaBogota, IVA, type Ciclo, type PlanIndividual } from './dominio';
import { nombreCiclo, nombrePlan } from './correo';

export const ALEGRA_USER = defineSecret('ALEGRA_USER');
export const ALEGRA_TOKEN = defineSecret('ALEGRA_TOKEN');
/** Contacto "consumidor final" (222222222222) en Alegra, si el profe no pidió factura a su nombre. */
export const ALEGRA_CLIENTE_ID = defineString('ALEGRA_CLIENTE_ID', { default: '' });
/** Producto "Suscripción Ceti" creado en Alegra. */
export const ALEGRA_ITEM_ID = defineString('ALEGRA_ITEM_ID', { default: '' });
/** Impuesto IVA 19 % en Alegra. */
export const ALEGRA_IVA_ID = defineString('ALEGRA_IVA_ID', { default: '' });

export const SECRETOS_ALEGRA = [ALEGRA_USER, ALEGRA_TOKEN];

export const COL_FACTURAS = 'facturas';
export const URL_ALEGRA_FACTURAS = 'https://api.alegra.com/api/v1/invoices';
/** El webhook de Wompi espera respuesta rápida: Alegra no lo puede frenar. */
const TIEMPO_ALEGRA_MS = 8_000;

export interface PagoFacturable {
  id: string;
  uid: string;
  referencia: string;
  plan: PlanIndividual;
  ciclo: Ciclo;
  montoCop: number;
}

export interface ClienteFactura {
  email: string | null;
  nombre?: string | null;
}

export interface CredencialesAlegra {
  usuario: string;
  token: string;
  clienteId: string;
  itemId: string;
  ivaId: string;
}

export interface OpcionesFactura {
  db?: Firestore;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** null = Alegra sin configurar. Por defecto se leen los parámetros. */
  credenciales?: CredencialesAlegra | null;
  ahora?: number;
}

export type EstadoFactura = 'pendiente' | 'emitida';

export interface ResultadoFactura {
  estado: EstadoFactura;
  error: string | null;
}

function leerParam(p: { value(): string }): string {
  try {
    return p.value().trim();
  } catch {
    return '';
  }
}

/** Valores sin configurar o de relleno ("pendiente") cuentan como ausentes. */
function presente(v: string): boolean {
  return v.length > 0 && v.toLowerCase() !== 'pendiente';
}

export function credencialesAlegra(): CredencialesAlegra | null {
  const usuario = leerParam(ALEGRA_USER);
  const token = leerParam(ALEGRA_TOKEN);
  if (!presente(usuario) || !presente(token)) return null;
  return {
    usuario,
    token,
    clienteId: leerParam(ALEGRA_CLIENTE_ID),
    itemId: leerParam(ALEGRA_ITEM_ID),
    ivaId: leerParam(ALEGRA_IVA_ID),
  };
}

/** Nombre del ítem facturado: 'Ceti Piloto mensual' / 'Ceti Comandante Año escolar'. */
export function nombreItem(plan: PlanIndividual, ciclo: Ciclo): string {
  return `Ceti ${nombrePlan(plan)} ${nombreCiclo(ciclo)}`;
}

/** Cuerpo de la factura para la API de Alegra. Puro. */
export function cuerpoAlegra(
  pago: PagoFacturable,
  cliente: ClienteFactura,
  cred: CredencialesAlegra,
  ahora: number
): Record<string, unknown> {
  const { base } = desgloseIvaIncluido(pago.montoCop);
  const hoy = fechaBogota(ahora);
  return {
    date: hoy,
    dueDate: hoy,
    client: { id: Number(cred.clienteId) || cred.clienteId },
    paymentForm: 'CASH',
    items: [
      {
        id: Number(cred.itemId) || cred.itemId,
        name: nombreItem(pago.plan, pago.ciclo),
        description: `Suscripción ${nombreItem(pago.plan, pago.ciclo)} · ref. ${pago.referencia}`,
        price: base,
        quantity: 1,
        tax: [{ id: Number(cred.ivaId) || cred.ivaId }],
      },
    ],
    observations: `Referencia de pago ${pago.referencia}. IVA ${Math.round(IVA * 100)} % incluido en el precio anunciado.`,
    anotation: cliente.email ? `Correo del cliente: ${cliente.email}` : undefined,
    stamp: { generateStamp: true },
  };
}

/**
 * Registra y, si se puede, emite la factura de un pago aprobado. Idempotente:
 * no vuelve a emitir una factura ya emitida. Nunca lanza.
 */
export async function emitirFactura(
  pago: PagoFacturable,
  cliente: ClienteFactura,
  opciones: OpcionesFactura = {}
): Promise<ResultadoFactura> {
  const db = opciones.db ?? getFirestore();
  const ahora = opciones.ahora ?? Date.now();
  const ref = db.collection(COL_FACTURAS).doc(pago.id);
  try {
    const previa = await ref.get();
    if (previa.exists && previa.data()?.estado === 'emitida') return { estado: 'emitida', error: null };

    const { base, iva } = desgloseIvaIncluido(pago.montoCop);
    await ref.set(
      {
        pagoId: pago.id,
        uid: pago.uid,
        email: cliente.email,
        referencia: pago.referencia,
        plan: pago.plan,
        ciclo: pago.ciclo,
        item: nombreItem(pago.plan, pago.ciclo),
        montoCop: pago.montoCop,
        baseCop: base,
        ivaCop: iva,
        estado: 'pendiente',
        error: null,
        creadaAt: previa.exists ? (previa.data()?.creadaAt ?? ahora) : ahora,
        actualizadaAt: ahora,
      },
      { merge: true }
    );

    const cred = opciones.credenciales === undefined ? credencialesAlegra() : opciones.credenciales;
    if (!cred) {
      await ref.update({ error: 'alegra_no_configurado' });
      return { estado: 'pendiente', error: 'alegra_no_configurado' };
    }
    if (!cred.clienteId || !cred.itemId || !cred.ivaId) {
      const error = 'Faltan ALEGRA_CLIENTE_ID, ALEGRA_ITEM_ID o ALEGRA_IVA_ID.';
      await ref.update({ error });
      return { estado: 'pendiente', error };
    }

    const f = opciones.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init));
    const auth = Buffer.from(`${cred.usuario}:${cred.token}`, 'utf8').toString('base64');
    let error: string | null = null;
    let respuesta: Record<string, unknown> | null = null;
    try {
      const resp = await f(URL_ALEGRA_FACTURAS, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(cuerpoAlegra(pago, cliente, cred, ahora)),
        signal: AbortSignal.timeout(TIEMPO_ALEGRA_MS),
      });
      const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
      if (!resp.ok) {
        const msg = typeof json?.message === 'string' ? json.message : '';
        error = `Alegra respondió ${resp.status}${msg ? `: ${msg.slice(0, 200)}` : ''}`;
      } else {
        respuesta = json ?? {};
      }
    } catch (e) {
      error = `Alegra no respondió: ${e instanceof Error ? e.message.slice(0, 200) : 'error de red'}`;
    }

    if (error || !respuesta) {
      await ref.update({ error: error ?? 'Alegra respondió vacío', actualizadaAt: ahora });
      console.warn('emitirFactura: queda pendiente', { pagoId: pago.id });
      return { estado: 'pendiente', error: error ?? 'Alegra respondió vacío' };
    }

    const numero = (respuesta.numberTemplate as { fullNumber?: unknown } | undefined)?.fullNumber;
    const url = typeof respuesta.pdf === 'string' ? respuesta.pdf : null;
    await ref.update({
      estado: 'emitida',
      error: null,
      alegraId: respuesta.id ?? null,
      numero: typeof numero === 'string' ? numero : null,
      url,
      emitidaAt: ahora,
      actualizadaAt: ahora,
    });
    if (url) await db.collection('pagos').doc(pago.id).update({ facturaUrl: url });
    return { estado: 'emitida', error: null };
  } catch (e) {
    console.error('emitirFactura: no se pudo registrar la factura', { pagoId: pago.id, e });
    return { estado: 'pendiente', error: 'firestore' };
  }
}
