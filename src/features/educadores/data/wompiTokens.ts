/**
 * Tokeniza la tarjeta del profe DIRECTO contra Wompi con la llave pública. Los
 * datos de la tarjeta van del formulario a Wompi y nunca pasan por Ceti: Ceti
 * solo recibe el token (`tok_…`) y con él el servidor crea la fuente de pago
 * para el cobro automático (suscribirConMedio).
 *
 * Nada de este archivo registra en logs ni guarda el número, el CVC o el titular.
 *
 * Variables: EXPO_PUBLIC_WOMPI_PUBLIC_KEY (pub_test_… / pub_prod_…) y
 * EXPO_PUBLIC_WOMPI_ENV ('sandbox' | 'production'; por defecto sandbox).
 */
import { leerVencimiento, marcaTarjeta, soloDigitos, type FormularioTarjeta } from './pagoHelpers';

export type EntornoWompi = 'sandbox' | 'production';

export function entornoWompi(valor = process.env.EXPO_PUBLIC_WOMPI_ENV): EntornoWompi {
  return valor === 'production' ? 'production' : 'sandbox';
}

export function urlBaseWompi(entorno: EntornoWompi = entornoWompi()): string {
  return entorno === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';
}

export class ErrorWompi extends Error {
  constructor(
    public readonly codigo: 'sin_llave' | 'datos' | 'rechazada' | 'red',
    mensaje: string
  ) {
    super(mensaje);
    this.name = 'ErrorWompi';
  }
}

export interface TokenTarjeta {
  /** 'tok_test_…' / 'tok_prod_…' */
  id: string;
  marca: string;
  ultimos4: string;
}

/** Cuerpo que espera Wompi en POST /tokens/cards. */
export function cuerpoTokenTarjeta(f: FormularioTarjeta): {
  number: string;
  exp_month: string;
  exp_year: string;
  cvc: string;
  card_holder: string;
} {
  const v = leerVencimiento(f.vence);
  if (!v) throw new ErrorWompi('datos', 'Vencimiento inválido');
  return {
    number: soloDigitos(f.numero),
    exp_month: v.mes,
    exp_year: v.anio,
    cvc: f.cvc,
    card_holder: f.titular.trim(),
  };
}

export interface OpcionesWompi {
  llave?: string;
  entorno?: EntornoWompi;
  fetchImpl?: typeof fetch;
}

/** Tokeniza la tarjeta (la demo /dev/profe reemplaza `clienteWompi.tokenizar` sin red). */
export function tokenizarTarjeta(f: FormularioTarjeta, opciones: OpcionesWompi = {}) {
  return clienteWompi.tokenizar(f, opciones);
}

async function tokenizarConWompi(
  f: FormularioTarjeta,
  opciones: OpcionesWompi
): Promise<TokenTarjeta> {
  const llave = opciones.llave ?? process.env.EXPO_PUBLIC_WOMPI_PUBLIC_KEY;
  if (!llave) throw new ErrorWompi('sin_llave', 'Falta EXPO_PUBLIC_WOMPI_PUBLIC_KEY');
  const cuerpo = cuerpoTokenTarjeta(f);
  const hacerFetch = opciones.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await hacerFetch(`${urlBaseWompi(opciones.entorno)}/tokens/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llave}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorWompi('red', 'Sin conexión con Wompi');
  }
  let json: { data?: { id?: string; brand?: string; last_four?: string }; status?: string } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    // Respuesta sin JSON: se trata abajo como rechazo.
  }
  const id = json.data?.id;
  if (!res.ok || !id) {
    // 422 = datos que Wompi no acepta; el resto, rechazo genérico. Sin detalles de la tarjeta.
    throw new ErrorWompi(res.status === 422 ? 'datos' : 'rechazada', `Wompi ${res.status}`);
  }
  return {
    id,
    marca: json.data?.brand ?? marcaTarjeta(cuerpo.number),
    ultimos4: json.data?.last_four ?? cuerpo.number.slice(-4),
  };
}

export const clienteWompi = { tokenizar: tokenizarConWompi };
