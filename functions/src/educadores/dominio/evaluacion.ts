/**
 * Fase 6 — escala de notas y periodos de la entidad: el SIEE del colegio
 * (Decreto 1290, art. 4 y 5) o el calendario semestral de la universidad. Vive
 * en `colegios/{cid}/config/evaluacion` y la usan Notas, el Análisis de la
 * clase, la ficha del estudiante y la exportación. Sin configuración rige la
 * escala 1,0–5,0 y los 4 periodos del calendario A. Puro.
 *
 * Los periodos se guardan como mes-día ('MM-DD') para que sirvan cada año; un
 * periodo que cruza el fin de año (calendario B) no está soportado: se parte en
 * dos.
 */
import { ESCALA_POR_DEFECTO, DESEMPENOS, type EscalaSiee } from './notas1290';
import { fechaBogota, periodosCalendarioA, type Periodo } from './calendario';

export const CALENDARIOS = ['periodos', 'semestres'] as const;
export type Calendario = (typeof CALENDARIOS)[number];

export interface PeriodoConfig {
  nombre: string;
  /** 'MM-DD' inclusive. */
  desde: string;
  hasta: string;
}

export interface ConfigEvaluacion {
  calendario: Calendario;
  escala: EscalaSiee;
  periodos: PeriodoConfig[];
  actualizadoAt?: number;
  actualizadoPor?: string;
}

export const MAX_PERIODOS = 6;

export const PERIODOS_COLEGIO: PeriodoConfig[] = [
  { nombre: 'Periodo 1', desde: '02-01', hasta: '04-15' },
  { nombre: 'Periodo 2', desde: '04-16', hasta: '06-30' },
  { nombre: 'Periodo 3', desde: '07-01', hasta: '09-15' },
  { nombre: 'Periodo 4', desde: '09-16', hasta: '11-30' },
];

export const PERIODOS_UNIVERSIDAD: PeriodoConfig[] = [
  { nombre: 'Semestre 1', desde: '02-01', hasta: '06-15' },
  { nombre: 'Semestre 2', desde: '07-20', hasta: '11-30' },
];

export function evaluacionPorDefecto(calendario: Calendario = 'periodos'): ConfigEvaluacion {
  return {
    calendario,
    escala: ESCALA_POR_DEFECTO,
    periodos: calendario === 'semestres' ? PERIODOS_UNIVERSIDAD : PERIODOS_COLEGIO,
  };
}

const MES_DIA = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function mesDiaValido(v: unknown): v is string {
  if (typeof v !== 'string' || !MES_DIA.test(v)) return false;
  const [m, d] = v.split('-').map(Number);
  return d <= DIAS_MES[m - 1];
}

export type ErrorEvaluacion =
  | 'escala_invalida'
  | 'rangos_invalidos'
  | 'sin_periodos'
  | 'demasiados_periodos'
  | 'periodo_invalido'
  | 'periodos_cruzados';

export const MENSAJES_ERROR_EVALUACION: Record<ErrorEvaluacion, string> = {
  escala_invalida: 'La nota mínima debe ser menor que la máxima (entre 0 y 100).',
  rangos_invalidos: 'Los desempeños deben ir de menor a mayor, dentro de la escala, empezando en la nota mínima.',
  sin_periodos: 'Agrega al menos un periodo.',
  demasiados_periodos: `Hasta ${MAX_PERIODOS} periodos.`,
  periodo_invalido: 'Cada periodo necesita nombre y fechas válidas, y empieza antes de terminar.',
  periodos_cruzados: 'Los periodos no pueden cruzarse y van en orden.',
};

function redondear1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Valida y normaliza lo que manda el admin. */
export function leerEvaluacion(
  v: unknown
): { ok: true; config: ConfigEvaluacion } | { ok: false; error: ErrorEvaluacion } {
  const d = (v ?? {}) as Record<string, unknown>;
  const calendario: Calendario = d.calendario === 'semestres' ? 'semestres' : 'periodos';
  const e = (d.escala ?? {}) as Record<string, unknown>;
  const notaMin = typeof e.notaMin === 'number' ? redondear1(e.notaMin) : NaN;
  const notaMax = typeof e.notaMax === 'number' ? redondear1(e.notaMax) : NaN;
  if (!Number.isFinite(notaMin) || !Number.isFinite(notaMax) || notaMin < 0 || notaMax > 100 || notaMin >= notaMax) {
    return { ok: false, error: 'escala_invalida' };
  }
  const rangosIn = Array.isArray(e.rangos) ? e.rangos : [];
  if (rangosIn.length !== DESEMPENOS.length) return { ok: false, error: 'rangos_invalidos' };
  const rangos = DESEMPENOS.map((desempeno, i) => {
    const r = (rangosIn[i] ?? {}) as Record<string, unknown>;
    return { desempeno, min: typeof r.min === 'number' ? redondear1(r.min) : NaN, propio: r.desempeno };
  });
  const enOrden = rangos.every(
    (r, i) =>
      r.propio === r.desempeno &&
      Number.isFinite(r.min) &&
      r.min >= notaMin &&
      r.min <= notaMax &&
      (i === 0 ? r.min === notaMin : r.min > rangos[i - 1].min)
  );
  if (!enOrden) return { ok: false, error: 'rangos_invalidos' };

  const periodosIn = Array.isArray(d.periodos) ? d.periodos : [];
  if (periodosIn.length === 0) return { ok: false, error: 'sin_periodos' };
  if (periodosIn.length > MAX_PERIODOS) return { ok: false, error: 'demasiados_periodos' };
  const periodos: PeriodoConfig[] = [];
  for (const p of periodosIn as Record<string, unknown>[]) {
    const nombre = typeof p?.nombre === 'string' ? p.nombre.replace(/\s+/g, ' ').trim() : '';
    if (!nombre || nombre.length > 40 || !mesDiaValido(p.desde) || !mesDiaValido(p.hasta) || p.desde > p.hasta) {
      return { ok: false, error: 'periodo_invalido' };
    }
    const previo = periodos[periodos.length - 1];
    if (previo && p.desde <= previo.hasta) return { ok: false, error: 'periodos_cruzados' };
    periodos.push({ nombre, desde: p.desde, hasta: p.hasta });
  }
  return {
    ok: true,
    config: {
      calendario,
      escala: { notaMin, notaMax, rangos: rangos.map(({ desempeno, min }) => ({ desempeno, min })) },
      periodos,
    },
  };
}

/** Lee lo guardado en Firestore; si falta o está dañado, el valor por defecto. */
export function evaluacionDesdeDoc(v: unknown): ConfigEvaluacion {
  if (!v) return evaluacionPorDefecto();
  const r = leerEvaluacion(v);
  return r.ok ? r.config : evaluacionPorDefecto();
}

export interface PeriodoConNombre extends Periodo {
  nombre: string;
}

/** Los periodos de un año con fecha completa ('YYYY-MM-DD'), numerados desde 1. */
export function periodosDelAnio(config: ConfigEvaluacion | null | undefined, anio: number): PeriodoConNombre[] {
  if (!config) {
    return periodosCalendarioA(anio).map((p) => ({ ...p, nombre: `Periodo ${p.numero}` }));
  }
  return config.periodos.map((p, i) => ({
    numero: i + 1,
    nombre: p.nombre,
    desde: `${anio}-${p.desde}`,
    hasta: `${anio}-${p.hasta}`,
  }));
}

/**
 * Periodo en curso con la configuración de la entidad (o el último que terminó;
 * antes del primero del año, el último del año anterior).
 */
export function periodoActualDe(config: ConfigEvaluacion | null | undefined, ms: number): PeriodoConNombre {
  const fecha = fechaBogota(ms);
  const anio = Number(fecha.slice(0, 4));
  const lista = periodosDelAnio(config, anio);
  const dentro = lista.find((p) => p.desde <= fecha && fecha <= p.hasta);
  if (dentro) return dentro;
  const pasados = lista.filter((p) => p.hasta < fecha);
  if (pasados.length > 0) return pasados[pasados.length - 1];
  const previos = periodosDelAnio(config, anio - 1);
  return previos[previos.length - 1];
}
