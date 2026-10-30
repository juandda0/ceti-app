/**
 * Ciclo de vida de la suscripción de un profe. Funciones puras: reciben el
 * estado y el instante, devuelven el estado nuevo (y, en el ciclo diario, las
 * acciones que el servidor debe ejecutar: cobrar, avisar, degradar). El
 * servidor es el único que escribe `suscripciones/{uid}`.
 *
 * Reglas de marca y de ley que viven aquí:
 * - Nada se borra al dejar de pagar: el plan baja a Cadete y lo que sobra queda
 *   en solo lectura (E8).
 * - Cancelar es un paso. Dentro del retracto (5 días hábiles, Ley 1480 art. 47)
 *   se devuelve todo; después, el plan sigue hasta el fin del periodo pagado.
 * - Aviso 7 días antes de renovar el Año escolar y 3 días antes de que acabe la
 *   prueba. Sin urgencia falsa.
 * - Pausa sin costo (mensual): congela los días pagados y no cobra hasta volver.
 */
import { DIA_MS, finRetracto, regresoAClases, sumarMeses } from './calendario';
import { esPlanIndividual, type PlanId, type PlanIndividual } from './planes';
import { DIAS_PRUEBA, MESES_POR_CICLO, type Ciclo } from './precios';

export const ESTADOS = ['prueba', 'activa', 'en_mora', 'pausada', 'cancelada', 'gratis'] as const;
export type EstadoSuscripcion = (typeof ESTADOS)[number];

export type MetodoPago = 'tarjeta' | 'nequi' | 'pse' | 'bre_b' | 'otro';

export interface Suscripcion {
  uid: string;
  /** Plan contratado. 'cadete' si nunca pagó. Mientras dura la prueba vale Piloto. */
  plan: PlanId;
  estado: EstadoSuscripcion;
  ciclo: Ciclo | null;
  /** Precio final cobrado por periodo (bloqueado al contratar; incluye tarifa fundador). */
  precioCop: number | null;
  fundador: boolean;
  /** Prueba de Piloto: fin (ms). Solo una por cuenta. */
  pruebaHasta: number | null;
  pruebaUsada: boolean;
  inicioPeriodo: number | null;
  finPeriodo: number | null;
  /** Primer pago del contrato vigente (para el retracto). */
  primerPagoAt: number | null;
  cancelarAlFinal: boolean;
  /** Pausa: hasta cuándo, y cuántos días pagados quedaron congelados. */
  pausadaHasta: number | null;
  diasCongelados: number | null;
  pausasEsteAnio: number;
  anioPausas: number | null;
  /** Reintentos de cobro tras un pago rechazado. */
  intentosFallidos: number;
  proximoReintento: number | null;
  /** Fuente de pago tokenizada en la pasarela (tarjeta o Nequi). Null = pago manual (PSE). */
  fuentePagoId: string | null;
  metodo: MetodoPago | null;
  /** Claves de avisos ya enviados para no repetirlos. */
  avisosEnviados: string[];
  creadaAt: number;
}

export class ErrorSuscripcion extends Error {
  constructor(
    public readonly codigo:
      | 'sin_plan_pago'
      | 'ya_pausada'
      | 'pausa_no_permitida'
      | 'pausa_muy_larga'
      | 'limite_pausas'
      | 'no_pausada'
      | 'nada_que_cancelar'
      | 'nada_que_reanudar',
    mensaje: string
  ) {
    super(mensaje);
    this.name = 'ErrorSuscripcion';
  }
}

export const GRACIA_MORA_DIAS = 7;
/** Reintentos tras el primer rechazo, en días desde el fin del periodo. */
export const REINTENTOS_DIAS = [1, 3, 6] as const;
export const PAUSA_MAX_DIAS = 92;
export const PAUSAS_POR_ANIO = 2;
export const AVISO_RENOVACION_DIAS = 7;
export const AVISO_FIN_PRUEBA_DIAS = 3;

/** Suscripción de un profe recién registrado: 14 días de Piloto. */
export function nuevaSuscripcion(uid: string, ahora: number): Suscripcion {
  return {
    uid,
    plan: 'cadete',
    estado: 'prueba',
    ciclo: null,
    precioCop: null,
    fundador: false,
    pruebaHasta: ahora + DIAS_PRUEBA * DIA_MS,
    pruebaUsada: true,
    inicioPeriodo: null,
    finPeriodo: null,
    primerPagoAt: null,
    cancelarAlFinal: false,
    pausadaHasta: null,
    diasCongelados: null,
    pausasEsteAnio: 0,
    anioPausas: null,
    intentosFallidos: 0,
    proximoReintento: null,
    fuentePagoId: null,
    metodo: null,
    avisosEnviados: [],
    creadaAt: ahora,
  };
}

/**
 * Plan que vale ahora mismo para el profe, sin contar licencias de colegio
 * (combinar con `mejorPlan` cuando el colegio tiene Nave).
 */
export function planEfectivo(sub: Suscripcion | null, ahora: number): PlanId {
  if (!sub) return 'cadete';
  switch (sub.estado) {
    case 'prueba':
      return sub.pruebaHasta !== null && ahora < sub.pruebaHasta ? 'piloto' : 'cadete';
    case 'activa':
    case 'cancelada':
      return sub.finPeriodo !== null && ahora < sub.finPeriodo ? sub.plan : 'cadete';
    case 'en_mora':
      return sub.finPeriodo !== null && ahora < sub.finPeriodo + GRACIA_MORA_DIAS * DIA_MS
        ? sub.plan
        : 'cadete';
    case 'pausada':
    case 'gratis':
      return 'cadete';
  }
}

/**
 * Plan vigente y hasta cuándo, sin depender de "ahora". El servidor lo guarda
 * denormalizado (`planVigente`, `vigenteHasta`) para que firestore.rules pueda
 * decidir con `request.time < vigenteHasta` sin reimplementar el ciclo de vida.
 */
export function vigencia(sub: Suscripcion): { plan: PlanId; hasta: number } {
  switch (sub.estado) {
    case 'prueba':
      return { plan: 'piloto', hasta: sub.pruebaHasta ?? 0 };
    case 'activa':
    case 'cancelada':
      return { plan: sub.plan, hasta: sub.finPeriodo ?? 0 };
    case 'en_mora':
      return { plan: sub.plan, hasta: (sub.finPeriodo ?? 0) + GRACIA_MORA_DIAS * DIA_MS };
    case 'pausada':
    case 'gratis':
      return { plan: 'cadete', hasta: 0 };
  }
}

/** Días que quedan de prueba (0 si no aplica). */
export function diasDePrueba(sub: Suscripcion | null, ahora: number): number {
  if (!sub || sub.estado !== 'prueba' || sub.pruebaHasta === null) return 0;
  return Math.max(0, Math.ceil((sub.pruebaHasta - ahora) / DIA_MS));
}

export interface PagoAprobado {
  plan: PlanIndividual;
  ciclo: Ciclo;
  montoCop: number;
  fundador: boolean;
  fuentePagoId: string | null;
  metodo: MetodoPago;
  ahora: number;
}

/**
 * Aplica un pago aprobado. Si el periodo pagado sigue vigente con el mismo plan
 * (renovación), el nuevo periodo empieza donde termina el anterior. Un cambio de
 * plan o de ciclo empieza hoy.
 */
export function aplicarPagoAprobado(sub: Suscripcion, pago: PagoAprobado): Suscripcion {
  const mismoPlan = sub.plan === pago.plan && sub.ciclo === pago.ciclo && sub.finPeriodo !== null;
  // Renovación: el periodo vigente sigue y el nuevo empieza donde termina.
  const renovacion =
    mismoPlan &&
    (sub.estado === 'activa' || sub.estado === 'cancelada') &&
    (sub.finPeriodo ?? 0) > pago.ahora;
  // Pago tras mora: arranca donde terminó el periodo anterior, para no regalar días.
  const recuperaMora = mismoPlan && sub.estado === 'en_mora';
  const continua = renovacion || recuperaMora;
  const inicio = continua && sub.finPeriodo !== null ? sub.finPeriodo : pago.ahora;
  const nuevoContrato = !continua;
  return {
    ...sub,
    plan: pago.plan,
    estado: 'activa',
    ciclo: pago.ciclo,
    precioCop: pago.montoCop,
    fundador: pago.fundador || (sub.fundador && continua),
    pruebaHasta: null,
    inicioPeriodo: inicio,
    finPeriodo: sumarMeses(inicio, MESES_POR_CICLO[pago.ciclo]),
    primerPagoAt: nuevoContrato || sub.primerPagoAt === null ? pago.ahora : sub.primerPagoAt,
    cancelarAlFinal: false,
    pausadaHasta: null,
    diasCongelados: null,
    intentosFallidos: 0,
    proximoReintento: null,
    fuentePagoId: pago.fuentePagoId ?? sub.fuentePagoId,
    metodo: pago.metodo,
  };
}

/** Un cobro automático fue rechazado: entra en mora con reintentos. */
export function aplicarPagoRechazado(sub: Suscripcion, ahora: number): Suscripcion {
  const intentos = sub.intentosFallidos + 1;
  const base = sub.finPeriodo ?? ahora;
  const siguiente = REINTENTOS_DIAS[intentos - 1];
  return {
    ...sub,
    estado: 'en_mora',
    intentosFallidos: intentos,
    proximoReintento: siguiente === undefined ? null : Math.max(ahora, base + siguiente * DIA_MS),
  };
}

/** ¿Está dentro del retracto de 5 días hábiles desde el primer pago? */
export function enRetracto(sub: Suscripcion, ahora: number): boolean {
  return sub.primerPagoAt !== null && ahora <= finRetracto(sub.primerPagoAt);
}

export interface ResultadoCancelacion {
  sub: Suscripcion;
  /** Devolver el último pago completo (retracto). */
  reembolsar: boolean;
  /** Hasta cuándo conserva el plan. */
  accesoHasta: number;
}

/**
 * Cancelar en un paso. Prueba → Cadete de inmediato. Retracto → reembolso total y
 * Cadete hoy. Si no, conserva el plan hasta el fin del periodo y no se renueva.
 */
export function cancelar(sub: Suscripcion, ahora: number): ResultadoCancelacion {
  if (sub.estado === 'prueba') {
    return { sub: { ...sub, estado: 'gratis', pruebaHasta: ahora }, reembolsar: false, accesoHasta: ahora };
  }
  if (sub.estado === 'gratis' || (sub.estado === 'cancelada' && sub.cancelarAlFinal)) {
    throw new ErrorSuscripcion('nada_que_cancelar', 'No hay un plan que cancelar.');
  }
  if (enRetracto(sub, ahora)) {
    return {
      sub: {
        ...sub,
        estado: 'gratis',
        finPeriodo: ahora,
        cancelarAlFinal: false,
        pausadaHasta: null,
        diasCongelados: null,
        proximoReintento: null,
        fuentePagoId: null,
      },
      reembolsar: true,
      accesoHasta: ahora,
    };
  }
  if (sub.estado === 'pausada' || sub.estado === 'en_mora') {
    // Pausada: los días congelados no se cobraron de nuevo, pero ya se pagaron;
    // se conservan como acceso desde hoy. En mora: no hay periodo pagado vigente.
    const accesoHasta =
      sub.estado === 'pausada' && sub.diasCongelados ? ahora + sub.diasCongelados * DIA_MS : ahora;
    return {
      sub: {
        ...sub,
        estado: accesoHasta > ahora ? 'cancelada' : 'gratis',
        finPeriodo: accesoHasta,
        cancelarAlFinal: accesoHasta > ahora,
        pausadaHasta: null,
        diasCongelados: null,
        proximoReintento: null,
        fuentePagoId: null,
      },
      reembolsar: false,
      accesoHasta,
    };
  }
  const accesoHasta = sub.finPeriodo ?? ahora;
  return {
    sub: { ...sub, estado: 'cancelada', cancelarAlFinal: true, fuentePagoId: null },
    reembolsar: false,
    accesoHasta,
  };
}

/** Deshacer una cancelación antes de que termine el periodo (requiere volver a pagar al renovar). */
export function revertirCancelacion(sub: Suscripcion, ahora: number): Suscripcion {
  if (sub.estado !== 'cancelada' || sub.finPeriodo === null || sub.finPeriodo <= ahora) {
    throw new ErrorSuscripcion('nada_que_reanudar', 'No hay una cancelación pendiente.');
  }
  return { ...sub, estado: 'activa', cancelarAlFinal: false };
}

/** Fecha sugerida para volver de una pausa: el regreso a clases o un mes. */
export function finPausaSugerido(ahora: number): number {
  return regresoAClases(ahora) ?? sumarMeses(ahora, 1);
}

/**
 * Pausar sin costo (solo mensual activo). Congela los días pagados restantes:
 * al volver, se usan antes del siguiente cobro.
 */
export function pausar(sub: Suscripcion, hasta: number, ahora: number): Suscripcion {
  if (sub.estado === 'pausada') throw new ErrorSuscripcion('ya_pausada', 'Ya está en pausa.');
  if (sub.estado !== 'activa' || sub.ciclo !== 'mensual' || !esPlanIndividual(sub.plan)) {
    throw new ErrorSuscripcion(
      'pausa_no_permitida',
      'Solo se pausa un plan mensual activo. El semestral y el Año escolar ya cubren las vacaciones.'
    );
  }
  if (hasta <= ahora || hasta - ahora > PAUSA_MAX_DIAS * DIA_MS) {
    throw new ErrorSuscripcion('pausa_muy_larga', `La pausa dura entre 1 y ${PAUSA_MAX_DIAS} días.`);
  }
  const anio = new Date(ahora).getUTCFullYear();
  const usadas = sub.anioPausas === anio ? sub.pausasEsteAnio : 0;
  if (usadas >= PAUSAS_POR_ANIO) {
    throw new ErrorSuscripcion('limite_pausas', `Puedes pausar ${PAUSAS_POR_ANIO} veces al año.`);
  }
  const restantes = sub.finPeriodo ? Math.max(0, Math.round((sub.finPeriodo - ahora) / DIA_MS)) : 0;
  return {
    ...sub,
    estado: 'pausada',
    pausadaHasta: hasta,
    diasCongelados: restantes,
    finPeriodo: ahora,
    cancelarAlFinal: false,
    pausasEsteAnio: usadas + 1,
    anioPausas: anio,
  };
}

export interface ResultadoReanudar {
  sub: Suscripcion;
  /** true si no quedaban días congelados y hay que cobrar el nuevo periodo ya. */
  cobrarAhora: boolean;
}

/** Volver de la pausa (a mano o al llegar la fecha). */
export function reanudar(sub: Suscripcion, ahora: number): ResultadoReanudar {
  if (sub.estado !== 'pausada') throw new ErrorSuscripcion('no_pausada', 'No está en pausa.');
  const dias = sub.diasCongelados ?? 0;
  return {
    sub: {
      ...sub,
      estado: 'activa',
      pausadaHasta: null,
      diasCongelados: null,
      inicioPeriodo: ahora,
      finPeriodo: ahora + dias * DIA_MS,
    },
    cobrarAhora: dias === 0,
  };
}

export type AccionCiclo =
  | { tipo: 'cobrar'; montoCop: number; plan: PlanIndividual; ciclo: Ciclo }
  | { tipo: 'aviso'; clave: string; plantilla: PlantillaAviso; fecha: number }
  | { tipo: 'degradado'; motivo: 'fin_prueba' | 'fin_cancelacion' | 'mora_agotada' | 'sin_medio_pago' }
  | { tipo: 'reanudada' };

export type PlantillaAviso =
  | 'fin_prueba_pronto'
  | 'renovacion_anual_pronto'
  | 'renovacion_manual_pronto'
  | 'pago_rechazado'
  | 'pausa_termina_pronto'
  | 'bajo_a_cadete';

function conAviso(
  sub: Suscripcion,
  acciones: AccionCiclo[],
  clave: string,
  plantilla: PlantillaAviso,
  fecha: number
): Suscripcion {
  if (sub.avisosEnviados.includes(clave)) return sub;
  acciones.push({ tipo: 'aviso', clave, plantilla, fecha });
  return { ...sub, avisosEnviados: [...sub.avisosEnviados.slice(-19), clave] };
}

/**
 * Lo que toca hacer hoy con una suscripción. El servidor lo corre una vez al día
 * por cada suscripción no gratuita y ejecuta las acciones (cobro tokenizado,
 * correo, etc.). Para un cobro, el resultado del cobro se aplica después con
 * `aplicarPagoAprobado` / `aplicarPagoRechazado`.
 */
export function cicloDiario(
  entrada: Suscripcion,
  ahora: number
): { sub: Suscripcion; acciones: AccionCiclo[] } {
  const acciones: AccionCiclo[] = [];
  let sub = entrada;

  switch (sub.estado) {
    case 'prueba': {
      const fin = sub.pruebaHasta ?? ahora;
      if (ahora >= fin) {
        sub = { ...sub, estado: 'gratis' };
        acciones.push({ tipo: 'degradado', motivo: 'fin_prueba' });
        sub = conAviso(sub, acciones, `cadete:${fin}`, 'bajo_a_cadete', fin);
      } else if (fin - ahora <= AVISO_FIN_PRUEBA_DIAS * DIA_MS) {
        sub = conAviso(sub, acciones, `prueba:${fin}`, 'fin_prueba_pronto', fin);
      }
      break;
    }
    case 'cancelada': {
      const fin = sub.finPeriodo ?? ahora;
      if (ahora >= fin) {
        sub = { ...sub, estado: 'gratis', cancelarAlFinal: false };
        acciones.push({ tipo: 'degradado', motivo: 'fin_cancelacion' });
      }
      break;
    }
    case 'activa': {
      const fin = sub.finPeriodo ?? ahora;
      const plan = sub.plan;
      if (!esPlanIndividual(plan) || sub.ciclo === null || sub.precioCop === null) break;
      if (ahora >= fin) {
        if (sub.fuentePagoId) {
          acciones.push({ tipo: 'cobrar', montoCop: sub.precioCop, plan, ciclo: sub.ciclo });
        } else {
          // Pago manual (PSE / Bre-B) sin renovar: un periodo de gracia para pagar.
          sub = { ...sub, estado: 'en_mora', intentosFallidos: REINTENTOS_DIAS.length, proximoReintento: null };
          sub = conAviso(sub, acciones, `manual:${fin}`, 'renovacion_manual_pronto', fin);
        }
      } else if (fin - ahora <= AVISO_RENOVACION_DIAS * DIA_MS) {
        // Semestral y Año escolar avisan 7 días antes aunque se cobren solos.
        if (sub.ciclo === 'anioEscolar' || sub.ciclo === 'semestral') {
          sub = conAviso(sub, acciones, `renov:${fin}`, 'renovacion_anual_pronto', fin);
        } else if (!sub.fuentePagoId) {
          sub = conAviso(sub, acciones, `manual:${fin}`, 'renovacion_manual_pronto', fin);
        }
      }
      break;
    }
    case 'en_mora': {
      const fin = sub.finPeriodo ?? ahora;
      const plan = sub.plan;
      if (ahora >= fin + GRACIA_MORA_DIAS * DIA_MS) {
        sub = { ...sub, estado: 'gratis', proximoReintento: null, fuentePagoId: sub.fuentePagoId };
        acciones.push({ tipo: 'degradado', motivo: 'mora_agotada' });
        sub = conAviso(sub, acciones, `cadete:${fin}`, 'bajo_a_cadete', ahora);
      } else if (
        sub.fuentePagoId &&
        sub.proximoReintento !== null &&
        ahora >= sub.proximoReintento &&
        esPlanIndividual(plan) &&
        sub.ciclo !== null &&
        sub.precioCop !== null
      ) {
        acciones.push({ tipo: 'cobrar', montoCop: sub.precioCop, plan, ciclo: sub.ciclo });
      }
      break;
    }
    case 'pausada': {
      const hasta = sub.pausadaHasta ?? ahora;
      if (ahora >= hasta) {
        const r = reanudar(sub, ahora);
        sub = r.sub;
        acciones.push({ tipo: 'reanudada' });
        if (r.cobrarAhora && esPlanIndividual(sub.plan) && sub.ciclo && sub.precioCop !== null) {
          if (sub.fuentePagoId) {
            acciones.push({ tipo: 'cobrar', montoCop: sub.precioCop, plan: sub.plan, ciclo: sub.ciclo });
          } else {
            sub = { ...sub, estado: 'en_mora', intentosFallidos: REINTENTOS_DIAS.length };
            sub = conAviso(sub, acciones, `manual:${ahora}`, 'renovacion_manual_pronto', ahora);
          }
        }
      } else if (hasta - ahora <= AVISO_FIN_PRUEBA_DIAS * DIA_MS) {
        sub = conAviso(sub, acciones, `pausa:${hasta}`, 'pausa_termina_pronto', hasta);
      }
      break;
    }
    case 'gratis':
      break;
  }
  return { sub, acciones };
}

/** Texto corto del estado para la app (clave i18n bajo educadores.estado.*). */
export function claveEstado(sub: Suscripcion | null, ahora: number): string {
  if (!sub) return 'gratis';
  if (sub.estado === 'prueba' && planEfectivo(sub, ahora) === 'cadete') return 'gratis';
  return sub.estado;
}
