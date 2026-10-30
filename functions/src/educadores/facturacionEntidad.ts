/**
 * Fase 6 — facturación a la entidad (ver dominio/facturaEntidad.ts). El admin
 * de la entidad guarda los datos para la factura electrónica, pide la
 * cotización y registra su orden de compra; Ceti (claim admin, backend) confirma
 * el pago con `activarLicenciaEntidad`, que activa la licencia y deja la factura
 * en `facturas/ent_{cotizacionId}` para emitirla a nombre del NIT.
 *
 * La factura de entidad queda 'pendiente' con `error: 'emision_manual'`: Alegra
 * necesita el contacto con NIT creado antes, y eso no se ha probado en vivo.
 * Operaciones la emite a mano (docs/educadores/operacion.md). Ningún cobro pasa
 * por la app.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  MENSAJES_ERROR_COTIZACION,
  MENSAJES_ERROR_FACTURACION,
  esCicloEntidad,
  esPlanEntidad,
  fechaBogota,
  itemFacturaEntidad,
  leerDatosFacturacion,
  licenciaDesdePago,
  nuevaCotizacion,
  numeroCotizacion,
  registrarOrden,
  type Cotizacion,
  type DatosFacturacion,
} from './dominio';
import { encolarCorreo } from './correo';
import { COL_FACTURAS } from './facturacion';
import { leerEntidad } from './entidades';

const OPS_POR_DEFECTO = 'juandiegodiazave@gmail.com';
const CETI_OPS_EMAIL = defineString('CETI_OPS_EMAIL', { default: OPS_POR_DEFECTO });

const refDatos = (db: Firestore, cid: string) => db.doc(`colegios/${cid}/facturacion/datos`);
const colCotizaciones = (db: Firestore, cid: string) => db.collection(`colegios/${cid}/cotizaciones`);

async function adminDeEntidad(request: CallableRequest): Promise<{ db: Firestore; uid: string; colegioId: string; nombre: string }> {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  const colegioId = caller.token.colegioId;
  if (caller.token.role !== 'profesor' || typeof colegioId !== 'string' || !colegioId) {
    throw new HttpsError('permission-denied', 'Solo para admins de una entidad.');
  }
  const db = getFirestore();
  const e = await leerEntidad(db, colegioId);
  if (!e.entidad) throw new HttpsError('failed-precondition', 'Primero crea la entidad.');
  if (e.profes.find((p) => p.uid === caller.uid)?.rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin de la entidad.');
  }
  return { db, uid: caller.uid, colegioId, nombre: e.entidad.nombre };
}

/** Datos para la factura electrónica (razón social, NIT con DV, correo…). */
export const guardarDatosFacturacion = onCall(async (request) => {
  const a = await adminDeEntidad(request);
  const r = leerDatosFacturacion(request.data?.datos);
  if (!r.ok) throw new HttpsError('invalid-argument', MENSAJES_ERROR_FACTURACION[r.error], { codigo: r.error });
  await refDatos(a.db, a.colegioId).set({ ...r.datos, actualizadoAt: Date.now(), actualizadoPor: a.uid });
  return { ok: true, datos: r.datos };
});

/** Cotización con número consecutivo del año, válida 30 días. */
export const cotizarPlanEntidad = onCall(async (request): Promise<Cotizacion> => {
  const a = await adminDeEntidad(request);
  const { plan, ciclo, cantidad } = (request.data ?? {}) as Record<string, unknown>;
  if (!esPlanEntidad(plan) || !esCicloEntidad(ciclo)) {
    throw new HttpsError('invalid-argument', 'Elige el plan (Equipo, Colegio o Universidad) y el ciclo (semestral o anual).');
  }
  if (typeof cantidad !== 'number' || !Number.isFinite(cantidad) || cantidad < 1 || cantidad > 100_000) {
    throw new HttpsError('invalid-argument', 'Escribe cuántos profes o estudiantes (de 1 a 100.000).');
  }
  const ahora = Date.now();
  const anio = Number(fechaBogota(ahora).slice(0, 4));
  const ref = colCotizaciones(a.db, a.colegioId).doc();
  const contador = a.db.doc(`contadores/cotizaciones-${anio}`);
  return a.db.runTransaction(async (tx) => {
    const c = await tx.get(contador);
    const n = (typeof c.get('n') === 'number' ? (c.get('n') as number) : 0) + 1;
    const cot = nuevaCotizacion(ref.id, numeroCotizacion(anio, n), plan, ciclo, cantidad, a.uid, ahora);
    tx.set(contador, { n });
    tx.set(ref, cot);
    return cot;
  });
});

/** La entidad registra el número de su orden de compra; avisa a operaciones. */
export const registrarOrdenCompra = onCall(async (request) => {
  const a = await adminDeEntidad(request);
  const id = request.data?.cotizacionId;
  if (typeof id !== 'string' || !id || id.includes('/')) throw new HttpsError('invalid-argument', 'Falta la cotización.');
  const ref = colCotizaciones(a.db, a.colegioId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa cotización.');
  const r = registrarOrden(snap.data() as Cotizacion, request.data?.orden, Date.now());
  if (!r.ok) throw new HttpsError('failed-precondition', MENSAJES_ERROR_COTIZACION[r.error], { codigo: r.error });
  await ref.set(r.cotizacion);
  const datos = (await refDatos(a.db, a.colegioId).get()).data() as DatosFacturacion | undefined;
  try {
    await encolarCorreo(a.db, {
      to: CETI_OPS_EMAIL.value() || OPS_POR_DEFECTO,
      plantilla: 'orden_compra_ops',
      datos: {
        colegio: a.nombre,
        colegioId: a.colegioId,
        referencia: r.cotizacion.numero,
        montoCop: r.cotizacion.total,
        ordenCompra: r.cotizacion.ordenCompra,
        nit: datos ? `${datos.nit}-${datos.dv} · ${datos.razonSocial}` : null,
        detalle: itemFacturaEntidad(r.cotizacion),
      },
    });
  } catch (err) {
    console.error('registrarOrdenCompra: no se pudo avisar a operaciones', { err: String(err) });
  }
  return { ok: true, cotizacion: r.cotizacion };
});

/**
 * activarLicenciaEntidad({colegioId, cotizacionId}). Solo admin de Ceti
 * (backend), tras confirmar el pago: activa la licencia y deja la factura.
 */
export const activarLicenciaEntidad = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (caller.token.role !== 'admin') throw new HttpsError('permission-denied', 'Solo un admin de Ceti activa licencias.');
  const { colegioId, cotizacionId } = (request.data ?? {}) as Record<string, unknown>;
  if (typeof colegioId !== 'string' || !colegioId || colegioId.includes('/') || typeof cotizacionId !== 'string' || !cotizacionId || cotizacionId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Faltan colegioId y cotizacionId.');
  }
  const db = getFirestore();
  const colegioRef = db.doc(`colegios/${colegioId}`);
  const cotRef = colCotizaciones(db, colegioId).doc(cotizacionId);
  const ahora = Date.now();
  const resultado = await db.runTransaction(async (tx) => {
    const [colegio, cot] = await Promise.all([tx.get(colegioRef), tx.get(cotRef)]);
    if (!colegio.exists || !cot.exists) throw new HttpsError('not-found', 'No existe la entidad o la cotización.');
    const c = cot.data() as Cotizacion;
    if (c.estado === 'pagada' || c.estado === 'anulada') {
      throw new HttpsError('failed-precondition', MENSAJES_ERROR_COTIZACION.estado);
    }
    const licencia = licenciaDesdePago(c, colegio.get('licencia'), ahora);
    // update reemplaza el mapa entero: una renovación no hereda campos viejos.
    tx.update(colegioRef, { licencia, licenciaActualizadaPor: caller.uid, licenciaActualizadaAt: ahora });
    tx.update(cotRef, { estado: 'pagada', pagadaAt: ahora });
    return { licencia, c };
  });
  const datos = (await refDatos(db, colegioId).get()).data() as DatosFacturacion | undefined;
  await db.doc(`${COL_FACTURAS}/ent_${cotizacionId}`).set({
    tipo: 'entidad',
    colegioId,
    cotizacionId,
    numeroCotizacion: resultado.c.numero,
    ordenCompra: resultado.c.ordenCompra,
    item: itemFacturaEntidad(resultado.c),
    baseCop: resultado.c.base,
    ivaCop: resultado.c.iva,
    montoCop: resultado.c.total,
    cliente: datos ?? null,
    estado: 'pendiente',
    error: datos ? 'emision_manual' : 'faltan_datos_facturacion',
    creadaAt: ahora,
    actualizadaAt: ahora,
  });
  return { ok: true, colegioId, licencia: resultado.licencia };
});
