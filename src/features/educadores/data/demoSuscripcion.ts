/**
 * Suscripción de ejemplo del profe, SOLO para desarrollo (ruta /dev/profe).
 * Reemplaza en memoria los métodos de `suscripcionRepository` (y la
 * tokenización de Wompi) para probar planes, pago, pausa y cancelación sin red.
 * Usa las mismas funciones puras del dominio que el servidor, así la interfaz
 * reacciona como lo haría con Firestore. Nunca escribe nada ni manda datos.
 *
 * Arranca en prueba de Piloto con ~9 días, sin licencia de colegio y con 2
 * pagos de ejemplo.
 */
import {
  aplicarPagoAprobado,
  cancelar,
  DIA_MS,
  nuevaSuscripcion,
  pausar,
  precioPlan,
  reanudar,
  revertirCancelacion,
  vigencia,
  FUNDADOR,
  type Ciclo,
  type MetodoPago,
  type PlanIndividual,
  type Suscripcion,
} from '@/functions/src/educadores/dominio';
import { suscripcionRepository, type PagoDoc, type SuscripcionDoc } from './suscripcionRepository';
import { clienteWompi } from './wompiTokens';
import { ultimosCuatro } from './pagoHelpers';

const PROFE = 'demo-profe';
/** Cupos fundador que "quedan" en la demo. */
const CUPOS_DEMO = 412;

let sub: Suscripcion | null = null;
let pagos: PagoDoc[] = [];
let usoIa = 12;
const oyentes = new Set<(s: SuscripcionDoc | null) => void>();

function doc(s: Suscripcion | null): SuscripcionDoc | null {
  if (!s) return null;
  const v = vigencia(s);
  return { ...s, planVigente: v.plan, vigenteHasta: v.hasta };
}

function emitir(): void {
  const d = doc(sub);
  oyentes.forEach((f) => f(d));
}

function fijar(s: Suscripcion): void {
  sub = s;
  emitir();
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simula el webhook de Wompi: aprueba el pago un rato después. */
function aprobarLuego(plan: PlanIndividual, ciclo: Ciclo, metodo: MetodoPago, ms: number): void {
  setTimeout(() => {
    if (!sub) return;
    const ahora = Date.now();
    const fundador = plan === 'piloto' && ciclo === 'mensual';
    const montoCop = precioPlan(plan, ciclo, fundador);
    pagos = [
      {
        id: `demo-pago-${ahora}`,
        uid: PROFE,
        referencia: `CETI-DEMO-${ahora.toString(36).toUpperCase()}`,
        plan,
        ciclo,
        montoCop,
        estado: 'aprobado',
        metodo,
        tipo: metodo === 'pse' || metodo === 'otro' ? 'checkout' : 'recurrente',
        creadoAt: ahora,
        facturaUrl: null,
      },
      ...pagos,
    ];
    fijar(
      aplicarPagoAprobado(sub, {
        plan,
        ciclo,
        montoCop,
        fundador,
        fuentePagoId: metodo === 'pse' || metodo === 'otro' ? null : `demo-fuente-${metodo}`,
        metodo,
        ahora,
      })
    );
  }, ms);
}

function estadoInicial(): void {
  const ahora = Date.now();
  // Se registró hace 5 días: le quedan ~9 de los 14 de prueba.
  const base = nuevaSuscripcion(PROFE, ahora - 5 * DIA_MS);
  sub = { ...base, pruebaHasta: ahora + 9 * DIA_MS - 60 * 60 * 1000 };
  pagos = [
    {
      id: 'demo-pago-2',
      uid: PROFE,
      referencia: 'CETI-DEMO-0002',
      plan: 'piloto',
      ciclo: 'mensual',
      montoCop: FUNDADOR.pilotoMensual,
      estado: 'reembolsado',
      metodo: 'nequi',
      tipo: 'recurrente',
      creadoAt: ahora - 200 * DIA_MS,
      facturaUrl: null,
    },
    {
      id: 'demo-pago-1',
      uid: PROFE,
      referencia: 'CETI-DEMO-0001',
      plan: 'piloto',
      ciclo: 'anioEscolar',
      montoCop: precioPlan('piloto', 'anioEscolar'),
      estado: 'aprobado',
      metodo: 'pse',
      tipo: 'checkout',
      creadoAt: ahora - 380 * DIA_MS,
      facturaUrl: null,
    },
  ];
  usoIa = 12;
}

export function aplicarDemoSuscripcion(): void {
  estadoInicial();

  suscripcionRepository.escucharSuscripcion = (_uid, cb) => {
    oyentes.add(cb);
    setTimeout(() => cb(doc(sub)), 150);
    return () => {
      oyentes.delete(cb);
    };
  };
  suscripcionRepository.escucharLicencia = (_colegioId, cb) => {
    setTimeout(() => cb(null), 150);
    return () => undefined;
  };
  suscripcionRepository.usoIaDelMes = async () => usoIa;
  suscripcionRepository.pagos = async () => {
    await esperar(250);
    return pagos;
  };

  suscripcionRepository.cotizar = async (plan, ciclo) => {
    await esperar(300);
    const fundador = plan === 'piloto' && ciclo === 'mensual';
    return { montoCop: precioPlan(plan, ciclo, fundador), fundador, cuposFundador: CUPOS_DEMO };
  };

  suscripcionRepository.crearCheckout = async (plan, ciclo) => {
    await esperar(500);
    aprobarLuego(plan, ciclo, 'pse', 1800);
    const fundador = plan === 'piloto' && ciclo === 'mensual';
    // Ruta interna: abrirCheckout la navega dentro de la app (un checkout real es https://).
    return {
      url: '/pago?id=demo-tx',
      referencia: 'CETI-DEMO-CHECKOUT',
      montoCop: precioPlan(plan, ciclo, fundador),
      fundador,
    };
  };

  suscripcionRepository.suscribirConNequi = async (plan, ciclo) => {
    await esperar(700);
    aprobarLuego(plan, ciclo, 'nequi', 3500);
    return { ok: true, referencia: 'CETI-DEMO-NEQUI' };
  };

  suscripcionRepository.suscribirConTarjeta = async (plan, ciclo) => {
    await esperar(700);
    aprobarLuego(plan, ciclo, 'tarjeta', 1500);
    return { ok: true, referencia: 'CETI-DEMO-TARJETA' };
  };

  suscripcionRepository.gestionar = async (accion, hasta) => {
    await esperar(500);
    if (!sub) throw new Error('Sin suscripción');
    const ahora = Date.now();
    if (accion === 'pausar') {
      fijar(pausar(sub, hasta ?? ahora + 30 * DIA_MS, ahora));
      return { ok: true, estado: sub.estado, reembolso: false, accesoHasta: null };
    }
    if (accion === 'reanudar') {
      fijar(reanudar(sub, ahora).sub);
      return { ok: true, estado: sub.estado, reembolso: false, accesoHasta: sub.finPeriodo };
    }
    if (accion === 'revertirCancelacion') {
      fijar(revertirCancelacion(sub, ahora));
      return { ok: true, estado: sub.estado, reembolso: false, accesoHasta: sub.finPeriodo };
    }
    const r = cancelar(sub, ahora);
    if (r.reembolsar && pagos[0]?.estado === 'aprobado') {
      pagos = [{ ...pagos[0], estado: 'reembolso_pendiente' }, ...pagos.slice(1)];
    }
    fijar(r.sub);
    return { ok: true, estado: r.sub.estado, reembolso: r.reembolsar, accesoHasta: r.accesoHasta };
  };

  // La tarjeta de la demo no sale del dispositivo: token falso, sin red.
  clienteWompi.tokenizar = async (f) => {
    await esperar(400);
    return { id: 'tok_demo_ceti', marca: 'DEMO', ultimos4: ultimosCuatro(f.numero) };
  };
}
