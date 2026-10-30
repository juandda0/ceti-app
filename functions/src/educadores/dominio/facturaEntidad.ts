/**
 * Fase 6 — facturación a la entidad: datos para la factura electrónica,
 * cotización, orden de compra y la licencia que resulta del pago. Las entidades
 * no pagan con tarjeta en la app: piden la cotización, la entidad emite su orden
 * de compra, paga por transferencia o PSE, y Ceti (admin de backend) confirma el
 * pago, activa la licencia y emite la factura a nombre de la entidad. Puro.
 */
import { DIA_MS, sumarMeses } from './calendario';
import {
  cotizarEntidad,
  MESES_CICLO_ENTIDAD,
  type CicloEntidad,
  type CotizacionEntidad,
  type PlanEntidad,
} from './precios';
import { licenciaVigente, planEntidadDe, type LicenciaEntidad } from './entidad';

/** Responsabilidades fiscales del RUT más comunes en colegios y universidades. */
export const RESPONSABILIDADES_FISCALES = ['R-99-PN', 'O-13', 'O-15', 'O-23', 'O-47'] as const;
export type ResponsabilidadFiscal = (typeof RESPONSABILIDADES_FISCALES)[number];

export interface DatosFacturacion {
  razonSocial: string;
  /** Solo dígitos, sin el DV. */
  nit: string;
  dv: string;
  direccion: string;
  ciudad: string;
  correoFactura: string;
  telefono: string | null;
  responsabilidad: ResponsabilidadFiscal;
}

const PESOS_DV = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Dígito de verificación del NIT (algoritmo de la DIAN, módulo 11). */
export function digitoVerificacionNit(nit: string): string {
  const digitos = nit.replace(/\D/g, '');
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    suma += Number(digitos[digitos.length - 1 - i]) * PESOS_DV[i];
  }
  const r = suma % 11;
  return String(r > 1 ? 11 - r : r);
}

export type ErrorFacturacion =
  | 'razon_social'
  | 'nit'
  | 'dv'
  | 'direccion'
  | 'ciudad'
  | 'correo'
  | 'responsabilidad';

export const MENSAJES_ERROR_FACTURACION: Record<ErrorFacturacion, string> = {
  razon_social: 'Escribe la razón social como aparece en el RUT.',
  nit: 'El NIT va sin puntos ni dígito de verificación (de 6 a 15 dígitos).',
  dv: 'El dígito de verificación no coincide con el NIT. Revísalo en el RUT.',
  direccion: 'Falta la dirección.',
  ciudad: 'Falta la ciudad.',
  correo: 'Revisa el correo de facturación: ahí llega la factura electrónica.',
  responsabilidad: 'Elige la responsabilidad fiscal del RUT.',
};

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function leerDatosFacturacion(
  v: unknown
): { ok: true; datos: DatosFacturacion } | { ok: false; error: ErrorFacturacion } {
  const d = (v ?? {}) as Record<string, unknown>;
  const razonSocial = texto(d.razonSocial, 120);
  if (razonSocial.length < 3) return { ok: false, error: 'razon_social' };
  const nit = typeof d.nit === 'string' ? d.nit.replace(/[.\s-]/g, '') : '';
  if (!/^\d{6,15}$/.test(nit)) return { ok: false, error: 'nit' };
  const dv = texto(d.dv, 1);
  if (dv !== digitoVerificacionNit(nit)) return { ok: false, error: 'dv' };
  const direccion = texto(d.direccion, 160);
  if (direccion.length < 5) return { ok: false, error: 'direccion' };
  const ciudad = texto(d.ciudad, 60);
  if (ciudad.length < 2) return { ok: false, error: 'ciudad' };
  const correoFactura = texto(d.correoFactura, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoFactura)) return { ok: false, error: 'correo' };
  const responsabilidad = d.responsabilidad;
  if (!(RESPONSABILIDADES_FISCALES as readonly unknown[]).includes(responsabilidad)) {
    return { ok: false, error: 'responsabilidad' };
  }
  const tel = texto(d.telefono, 20);
  return {
    ok: true,
    datos: {
      razonSocial,
      nit,
      dv,
      direccion,
      ciudad,
      correoFactura,
      telefono: tel || null,
      responsabilidad: responsabilidad as ResponsabilidadFiscal,
    },
  };
}

// ---------------------------------------------------------------------------
// Cotización y orden de compra
// ---------------------------------------------------------------------------

export const ESTADOS_COTIZACION = ['cotizada', 'orden_recibida', 'pagada', 'anulada'] as const;
export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];

export const DIAS_VIGENCIA_COTIZACION = 30;

export interface Cotizacion extends CotizacionEntidad {
  id: string;
  numero: string;
  estado: EstadoCotizacion;
  creadaAt: number;
  creadaPor: string;
  validaHasta: number;
  ordenCompra: string | null;
  ordenAt: number | null;
  pagadaAt: number | null;
}

/** 'COT-2026-0007'. */
export function numeroCotizacion(anio: number, consecutivo: number): string {
  return `COT-${anio}-${String(consecutivo).padStart(4, '0')}`;
}

export function nuevaCotizacion(
  id: string,
  numero: string,
  plan: PlanEntidad,
  ciclo: CicloEntidad,
  cantidad: number,
  creadaPor: string,
  ahora: number,
  padrinazgo = false
): Cotizacion {
  return {
    ...cotizarEntidad(plan, ciclo, cantidad, padrinazgo),
    id,
    numero,
    estado: 'cotizada',
    creadaAt: ahora,
    creadaPor,
    validaHasta: ahora + DIAS_VIGENCIA_COTIZACION * DIA_MS,
    ordenCompra: null,
    ordenAt: null,
    pagadaAt: null,
  };
}

export type ErrorCotizacion = 'vencida' | 'estado' | 'orden_invalida';

export const MENSAJES_ERROR_COTIZACION: Record<ErrorCotizacion, string> = {
  vencida: 'La cotización venció. Pide una nueva: los precios pueden haber cambiado.',
  estado: 'Esa cotización ya no se puede cambiar.',
  orden_invalida: 'Escribe el número de la orden de compra (de 2 a 40 caracteres).',
};

/** La entidad registra su orden de compra sobre una cotización vigente. */
export function registrarOrden(
  c: Cotizacion,
  orden: unknown,
  ahora: number
): { ok: true; cotizacion: Cotizacion } | { ok: false; error: ErrorCotizacion } {
  if (c.estado !== 'cotizada' && c.estado !== 'orden_recibida') return { ok: false, error: 'estado' };
  if (ahora > c.validaHasta) return { ok: false, error: 'vencida' };
  const numero = texto(orden, 40);
  if (numero.length < 2) return { ok: false, error: 'orden_invalida' };
  return { ok: true, cotizacion: { ...c, estado: 'orden_recibida', ordenCompra: numero, ordenAt: ahora } };
}

/**
 * La licencia que deja un pago confirmado. Si la entidad ya tiene vigente el
 * mismo plan, el periodo nuevo empieza cuando termina el actual (renovación);
 * si no, empieza hoy.
 */
export function licenciaDesdePago(
  c: Pick<Cotizacion, 'id' | 'plan' | 'ciclo' | 'cantidad' | 'padrinazgo'>,
  actual: LicenciaEntidad | null | undefined,
  ahora: number
): LicenciaEntidad {
  const vigente = licenciaVigente(actual, ahora);
  const inicio = vigente && planEntidadDe(vigente) === c.plan ? vigente.hasta : ahora;
  return {
    plan: c.plan,
    ciclo: c.ciclo,
    hasta: sumarMeses(inicio, MESES_CICLO_ENTIDAD[c.ciclo]),
    cupo: c.cantidad,
    padrino: c.padrinazgo ? (actual?.padrino ?? null) : null,
    cotizacionId: c.id,
  };
}

/** Nombre del ítem en la factura: 'Ceti Colegio anual · 450 estudiantes'. */
export function itemFacturaEntidad(c: Pick<CotizacionEntidad, 'plan' | 'ciclo' | 'cantidad' | 'unidad'>): string {
  const plan = { equipo: 'Equipo', colegio: 'Colegio', universidad: 'Universidad' }[c.plan];
  const unidad =
    c.unidad === 'profe'
      ? c.cantidad === 1
        ? 'profe'
        : 'profes'
      : c.unidad === 'estudiante'
        ? 'estudiantes'
        : 'estudiantes activos';
  return `Ceti ${plan} ${c.ciclo} · ${c.cantidad} ${unidad}`;
}
