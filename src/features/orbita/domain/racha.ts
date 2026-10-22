/**
 * La racha de Órbita: días seguidos (Bogotá) con al menos una práctica. Es una
 * sola racha para toda la app y vive en el servidor (ver orbitaSync).
 *
 * - Escudos: hasta MAX_ESCUDOS equipados. Si faltaste días y tienes escudos
 *   para cubrirlos TODOS, se gastan solos y la racha sigue. Si no alcanzan, no
 *   se gasta ninguno (no tiene sentido quemar escudos en una racha que igual se
 *   rompe).
 * - Reparación: si la racha se rompió por 1 o 2 días, hay hasta el día
 *   siguiente a cuando lo notaste para repararla haciendo PRACTICAS_PARA_REPARAR
 *   prácticas. Se gana, no se compra.
 * - Hitos: 7, 30, 100 y 365 días. Cada uno se cobra una sola vez.
 *
 * Puro: el store solo guarda lo que devuelven estas funciones.
 */
import { diasEntre, diasIntermedios, sumarDias } from './tiempo';

export const MAX_ESCUDOS = 2;
export const HITOS_RACHA = [7, 30, 100, 365] as const;
/** La reparación vale el día en que se detecta la ruptura y el siguiente (~48 h). */
export const VENTANA_REPARACION_DIAS = 1;
export const MAX_DIAS_REPARABLES = 2;
export const PRACTICAS_PARA_REPARAR = 2;
const MAX_DIAS_GUARDADOS = 400;

export interface RachaRota {
  /** Días que faltaron y que la reparación cubriría. */
  perdidos: string[];
  detectadaEn: string;
  /** Racha que había antes de romperse. */
  valor: number;
  /** Prácticas hechas dentro de la ventana de reparación. */
  practicas: number;
}

export interface EstadoRacha {
  /** Días con práctica, ordenados y sin repetir. */
  dias: string[];
  /** Días salvados por un escudo o por una reparación. */
  cubiertos: string[];
  escudos: number;
  rota?: RachaRota;
  /** Último día revisado; evita gastar escudos dos veces el mismo día. */
  revisadoEn?: string;
  /** Último día de práctica cuya pérdida ya se anunció. */
  perdidaAnunciada?: string;
  hitosCobrados: number[];
  mejor: number;
}

export const RACHA_INICIAL: EstadoRacha = {
  dias: [],
  cubiertos: [],
  escudos: 0,
  hitosCobrados: [],
  mejor: 0,
};

function conjunto(e: EstadoRacha): Set<string> {
  return new Set([...e.dias, ...e.cubiertos]);
}

/** Racha viva en `hoy`: cuenta hacia atrás desde hoy (o desde ayer si hoy aún no hay práctica). */
export function calcularRacha(e: EstadoRacha, hoy: string): number {
  const set = conjunto(e);
  let cursor = set.has(hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = sumarDias(cursor, -1);
  }
  return n;
}

export function practicoHoy(e: EstadoRacha, hoy: string): boolean {
  return e.dias.includes(hoy);
}

export function reparacionVigente(e: EstadoRacha, hoy: string): boolean {
  return !!e.rota && diasEntre(e.rota.detectadaEn, hoy) <= VENTANA_REPARACION_DIAS;
}

export interface RevisionRacha {
  estado: EstadoRacha;
  escudosUsados: number;
  /** La racha se rompió y todavía se puede reparar. */
  rotaReparable?: RachaRota;
  /** La racha se rompió sin reparación posible (se anuncia una vez). */
  perdida?: number;
}

/** Se llama al abrir la app: gasta escudos o marca la racha como rota. Idempotente por día. */
export function revisarRacha(e: EstadoRacha, hoy: string): RevisionRacha {
  let estado = e;
  // Una reparación vencida ya no se puede cobrar.
  if (estado.rota && !reparacionVigente(estado, hoy)) estado = { ...estado, rota: undefined };
  if (estado.revisadoEn === hoy || estado.rota) {
    return { estado: { ...estado, revisadoEn: hoy }, escudosUsados: 0 };
  }
  estado = { ...estado, revisadoEn: hoy };

  const anteriores = [...conjunto(estado)].filter((d) => d < hoy).sort();
  const ultimo = anteriores[anteriores.length - 1];
  if (!ultimo) return { estado, escudosUsados: 0 };
  const hueco = diasIntermedios(ultimo, hoy);
  if (hueco.length === 0) return { estado, escudosUsados: 0 };

  if (hueco.length <= estado.escudos) {
    return {
      estado: {
        ...estado,
        escudos: estado.escudos - hueco.length,
        cubiertos: [...estado.cubiertos, ...hueco].sort(),
      },
      escudosUsados: hueco.length,
    };
  }

  const valor = calcularRacha(estado, ultimo);
  if (hueco.length <= MAX_DIAS_REPARABLES) {
    const rota: RachaRota = { perdidos: hueco, detectadaEn: hoy, valor, practicas: 0 };
    return { estado: { ...estado, rota, perdidaAnunciada: ultimo }, escudosUsados: 0, rotaReparable: rota };
  }
  if (estado.perdidaAnunciada === ultimo) return { estado, escudosUsados: 0 };
  return { estado: { ...estado, perdidaAnunciada: ultimo }, escudosUsados: 0, perdida: valor };
}

export interface PracticaRacha {
  estado: EstadoRacha;
  primeroHoy: boolean;
  racha: number;
  reparada: boolean;
  /** Hito alcanzado por primera vez con esta práctica. */
  hito?: number;
}

/** Registra una práctica (lección, jefe o primer vuelo) en `hoy`. */
export function registrarPractica(e: EstadoRacha, hoy: string): PracticaRacha {
  const primeroHoy = !e.dias.includes(hoy);
  let estado: EstadoRacha = primeroHoy
    ? { ...e, dias: [...e.dias, hoy].sort().slice(-MAX_DIAS_GUARDADOS) }
    : e;

  let reparada = false;
  if (estado.rota && reparacionVigente(estado, hoy)) {
    const practicas = estado.rota.practicas + 1;
    if (practicas >= PRACTICAS_PARA_REPARAR) {
      estado = {
        ...estado,
        cubiertos: [...estado.cubiertos, ...estado.rota.perdidos].sort(),
        rota: undefined,
      };
      reparada = true;
    } else {
      estado = { ...estado, rota: { ...estado.rota, practicas } };
    }
  }

  const racha = calcularRacha(estado, hoy);
  const hito = HITOS_RACHA.find((h) => racha >= h && !estado.hitosCobrados.includes(h));
  if (hito) estado = { ...estado, hitosCobrados: [...estado.hitosCobrados, hito] };
  estado = { ...estado, mejor: Math.max(estado.mejor, racha) };
  return { estado, primeroHoy, racha, reparada, hito };
}

export function agregarEscudo(e: EstadoRacha): EstadoRacha | null {
  if (e.escudos >= MAX_ESCUDOS) return null;
  return { ...e, escudos: e.escudos + 1 };
}

/** Racha más larga dentro de una lista de días (para migrar la racha anterior). */
export function rachaMasLarga(dias: readonly string[]): number {
  const orden = [...new Set(dias)].sort();
  let mejor = 0;
  let actual = 0;
  orden.forEach((d, i) => {
    actual = i > 0 && diasEntre(orden[i - 1], d) === 1 ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
  });
  return mejor;
}

/** Días distintos con práctica (para los desbloqueos del avatar). */
export function diasAprendiendo(e: EstadoRacha): number {
  return e.dias.length;
}
