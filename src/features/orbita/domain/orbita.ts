/**
 * Estado de juego de una persona (un documento por usuario, ver orbitaSync) y
 * las dos operaciones que lo mueven: abrir la app y terminar una práctica.
 * Junta racha, XP, meta diaria, Cetis y Bóveda. Puro.
 */
import {
  RACHA_INICIAL,
  agregarEscudo,
  calcularRacha,
  practicoHoy,
  rachaMasLarga,
  registrarPractica,
  revisarRacha,
  MAX_ESCUDOS,
  type EstadoRacha,
  type RachaRota,
} from './racha';
import {
  LECCIONES_POR_META,
  PROGRESO_INICIAL,
  factorRendimiento,
  leccionesHoy,
  sumarLeccion,
  xpCierre,
  type EstadoProgreso,
  type MetaDiaria,
} from './progreso';
import { BOVEDA_INICIAL, ganar, liquidar, type Cdt, type EstadoBoveda } from './boveda';
import { RECOMPENSAS, ajustado, precioEscudo } from './economia';
import { HORA_POR_DEFECTO } from './avisos';

export interface AjustesOrbita {
  meta: MetaDiaria;
  /** Hora local (7..20) del aviso diario. */
  horaAviso: number;
  avisos: boolean;
  /** Ya hizo el primer vuelo del onboarding. */
  primerVuelo: boolean;
}

export interface EstadoOrbita {
  version: 1;
  racha: EstadoRacha;
  progreso: EstadoProgreso;
  boveda: EstadoBoveda;
  /** Lecciones terminadas (en orden) por mundo. */
  niveles: Record<string, number>;
  ajustes: AjustesOrbita;
  actualizadoEn: number;
}

export const AJUSTES_INICIALES: AjustesOrbita = {
  meta: 'crucero',
  horaAviso: HORA_POR_DEFECTO,
  avisos: false,
  primerVuelo: false,
};

/** `diasPrevios`: días de la racha local anterior (useQuizStreakStore), para no perderla. */
export function estadoInicial(now: number, diasPrevios: readonly string[] = []): EstadoOrbita {
  return {
    version: 1,
    racha: {
      ...RACHA_INICIAL,
      dias: [...new Set(diasPrevios)].sort(),
      mejor: rachaMasLarga(diasPrevios),
    },
    progreso: PROGRESO_INICIAL,
    boveda: BOVEDA_INICIAL,
    niveles: {},
    ajustes: AJUSTES_INICIALES,
    actualizadoEn: now,
  };
}

export interface EventosApertura {
  escudosUsados: number;
  rotaReparable?: RachaRota;
  rachaPerdida?: number;
  interes: number;
  cdtsVencidos: Cdt[];
}

export function alAbrir(
  e: EstadoOrbita,
  hoy: string,
  now: number
): { estado: EstadoOrbita; eventos: EventosApertura } {
  const r = revisarRacha(e.racha, hoy);
  const b = liquidar(e.boveda, hoy);
  const cambio = r.estado !== e.racha || b.estado !== e.boveda;
  return {
    estado: cambio ? { ...e, racha: r.estado, boveda: b.estado, actualizadoEn: now } : e,
    eventos: {
      escudosUsados: r.escudosUsados,
      rotaReparable: r.rotaReparable,
      rachaPerdida: r.perdida,
      interes: b.interes,
      cdtsVencidos: b.cdtsVencidos,
    },
  };
}

export type TipoPractica = 'leccion' | 'jefe' | 'primer_vuelo';

export interface PracticaInput {
  tipo: TipoPractica;
  worldId?: string;
  /** Índice de la lección (solo `leccion`). */
  nivel?: number;
  /** XP sumado por las respuestas (con combo). */
  xpRespuestas: number;
  perfecta: boolean;
}

export interface RecompensaPractica {
  estado: EstadoOrbita;
  xp: number;
  cetis: number;
  cetisHito: number;
  cetisMeta: number;
  racha: number;
  primeroHoy: boolean;
  reparada: boolean;
  hito?: number;
  metaCumplida: boolean;
  leccionesHoy: number;
  metaLecciones: number;
  escudoRegalado: boolean;
  /** Rinde la mitad porque ya pasó el doble de su meta. */
  rendimientoReducido: boolean;
}

function cetisBase(tipo: TipoPractica, perfecta: boolean): number {
  if (tipo === 'primer_vuelo') return RECOMPENSAS.primerVuelo;
  if (tipo === 'jefe') return RECOMPENSAS.jefe + (perfecta ? RECOMPENSAS.jefePerfecto : 0);
  return RECOMPENSAS.leccion + (perfecta ? RECOMPENSAS.leccionPerfecta : 0);
}

export function completarPractica(
  e: EstadoOrbita,
  input: PracticaInput,
  hoy: string,
  now: number
): RecompensaPractica {
  const meta = e.ajustes.meta;
  const metaLecciones = LECCIONES_POR_META[meta];
  const antes = leccionesHoy(e.progreso, hoy);
  const factor = factorRendimiento(antes, meta);

  const xp = Math.round((input.xpRespuestas + xpCierre(input.perfecta)) * factor);
  const cetis = Math.round(ajustado(cetisBase(input.tipo, input.perfecta), hoy) * factor);
  const progreso = sumarLeccion(e.progreso, hoy, xp);

  const p = registrarPractica(e.racha, hoy);
  let racha = p.estado;
  const cetisHito = p.hito ? ajustado(RECOMPENSAS.hitoRacha[p.hito] ?? 0, hoy) : 0;
  const metaCumplida = antes < metaLecciones && antes + 1 >= metaLecciones;
  const cetisMeta = metaCumplida ? ajustado(RECOMPENSAS.metaCumplida, hoy) : 0;

  let escudoRegalado = false;
  if (input.tipo === 'primer_vuelo' && racha.escudos === 0) {
    racha = agregarEscudo(racha) ?? racha;
    escudoRegalado = true;
  }

  const niveles = { ...e.niveles };
  if (input.tipo === 'leccion' && input.worldId && input.nivel !== undefined) {
    const hechas = niveles[input.worldId] ?? 0;
    if (input.nivel === hechas) niveles[input.worldId] = hechas + 1;
  }

  const estado: EstadoOrbita = {
    ...e,
    racha,
    progreso,
    niveles,
    boveda: ganar(e.boveda, cetis + cetisHito + cetisMeta),
    ajustes: input.tipo === 'primer_vuelo' ? { ...e.ajustes, primerVuelo: true } : e.ajustes,
    actualizadoEn: now,
  };
  return {
    estado,
    xp,
    cetis,
    cetisHito,
    cetisMeta,
    racha: p.racha,
    primeroHoy: p.primeroHoy,
    reparada: p.reparada,
    hito: p.hito,
    metaCumplida,
    leccionesHoy: antes + 1,
    metaLecciones,
    escudoRegalado,
    rendimientoReducido: factor < 1,
  };
}

export type ResultadoEscudo =
  | { ok: true; estado: EstadoOrbita; precio: number }
  | { ok: false; error: 'tope' | 'sin_cetis'; precio: number };

export function comprarEscudo(e: EstadoOrbita, hoy: string, now: number): ResultadoEscudo {
  const precio = precioEscudo(hoy);
  if (e.racha.escudos >= MAX_ESCUDOS) return { ok: false, error: 'tope', precio };
  // El escudo es el fondo de emergencia de la racha: se paga del bolsillo y,
  // si no alcanza, el resto sale de la Bóveda.
  const { bolsillo, boveda } = e.boveda;
  if (bolsillo + boveda < precio) return { ok: false, error: 'sin_cetis', precio };
  const delBolsillo = Math.min(bolsillo, precio);
  const deBoveda = precio - delBolsillo;
  const racha = agregarEscudo(e.racha) ?? e.racha;
  return {
    ok: true,
    precio,
    estado: {
      ...e,
      racha,
      boveda: { ...e.boveda, bolsillo: bolsillo - delBolsillo, boveda: boveda - deBoveda },
      actualizadoEn: now,
    },
  };
}

/** Resumen para pintar chips y anillos. */
export function resumen(e: EstadoOrbita, hoy: string) {
  return {
    racha: calcularRacha(e.racha, hoy),
    practicoHoy: practicoHoy(e.racha, hoy),
    escudos: e.racha.escudos,
    leccionesHoy: leccionesHoy(e.progreso, hoy),
    metaLecciones: LECCIONES_POR_META[e.ajustes.meta],
    cetis: e.boveda.bolsillo,
  };
}

/**
 * Valida un documento remoto. Devuelve null si no tiene la forma esperada
 * (mejor ignorarlo que romper la app con datos de otra versión).
 */
export function esEstadoOrbita(x: unknown): x is EstadoOrbita {
  if (!x || typeof x !== 'object') return false;
  const o = x as Partial<EstadoOrbita>;
  return (
    o.version === 1 &&
    typeof o.actualizadoEn === 'number' &&
    !!o.racha &&
    Array.isArray(o.racha.dias) &&
    Array.isArray(o.racha.cubiertos) &&
    typeof o.racha.escudos === 'number' &&
    !!o.progreso &&
    typeof o.progreso.xpTotal === 'number' &&
    !!o.boveda &&
    typeof o.boveda.bolsillo === 'number' &&
    typeof o.boveda.boveda === 'number' &&
    Array.isArray(o.boveda.cdts) &&
    !!o.niveles &&
    typeof o.niveles === 'object' &&
    !!o.ajustes &&
    typeof o.ajustes.meta === 'string'
  );
}
