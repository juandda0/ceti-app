import { estadoRetorno, VENTANA_RETORNO_MS } from './retornoPago';
import type { PagoDoc, SuscripcionDoc } from './suscripcionRepository';
import { nuevaSuscripcion, vigencia } from '@/functions/src/educadores/dominio';

const AHORA = Date.UTC(2026, 9, 22, 18);

function pago(over: Partial<PagoDoc>): PagoDoc {
  return {
    id: 'CETI-1',
    uid: 'u',
    referencia: 'CETI-1',
    plan: 'piloto',
    ciclo: 'anioEscolar',
    montoCop: 199_000,
    estado: 'pendiente',
    metodo: 'pse',
    tipo: 'checkout',
    creadoAt: AHORA - 60_000,
    ...over,
  };
}

function sub(over: Partial<SuscripcionDoc> = {}): SuscripcionDoc {
  const s = { ...nuevaSuscripcion('u', AHORA - 20 * 86_400_000), ...over };
  const v = vigencia(s);
  return { ...s, planVigente: v.plan, vigenteHasta: v.hasta, ...over };
}

describe('regreso de Wompi', () => {
  it('sigue el pago reciente: pendiente, aprobado o rechazado', () => {
    expect(estadoRetorno([pago({})], null, AHORA)).toEqual({ estado: 'pendiente' });
    expect(estadoRetorno([pago({ estado: 'aprobado', plan: 'comandante' })], null, AHORA)).toEqual({
      estado: 'aprobado',
      plan: 'comandante',
    });
    expect(estadoRetorno([pago({ estado: 'rechazado' })], null, AHORA)).toEqual({
      estado: 'rechazado',
    });
  });

  it('usa el más reciente e ignora pagos viejos y reembolsos', () => {
    const viejo = pago({ id: 'v', estado: 'aprobado', creadoAt: AHORA - VENTANA_RETORNO_MS - 1 });
    expect(estadoRetorno([viejo], null, AHORA)).toEqual({ estado: 'pendiente' });
    const lista = [
      pago({ id: 'a', estado: 'rechazado', creadoAt: AHORA - 120_000 }),
      pago({ id: 'b', estado: 'aprobado', creadoAt: AHORA - 10_000 }),
      pago({ id: 'r', tipo: 'reembolso', estado: 'reembolsado', creadoAt: AHORA - 1_000 }),
    ];
    expect(estadoRetorno(lista, null, AHORA).estado).toBe('aprobado');
  });

  it('sin pago visible, una suscripción recién activada cuenta como aprobado', () => {
    const activa = sub({
      estado: 'activa',
      plan: 'piloto',
      ciclo: 'anioEscolar',
      inicioPeriodo: AHORA - 30_000,
      finPeriodo: AHORA + 365 * 86_400_000,
    });
    expect(estadoRetorno([], activa, AHORA)).toEqual({ estado: 'aprobado', plan: 'piloto' });
    expect(estadoRetorno([], sub(), AHORA)).toEqual({ estado: 'pendiente' });
  });
});
