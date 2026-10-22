/**
 * Bitácora del domingo: el resumen semanal que mantiene el hábito del profe
 * (órbita semanal del diseño). Llega aunque no abra la app (correo) y también se
 * ve en la pestaña Clases. Solo datos del curso; ningún perfil individual de
 * menores sale de aquí más allá del nombre del estudiante en alerta, que el profe
 * ya ve en su tablero. Puro.
 */
import { DIA_MS } from './calendario';

/** Minutos que se ahorra el profe por cada quiz de 10 preguntas que Ceti califica (estimado). */
export const MINUTOS_POR_QUIZ = 3;
/** Minutos que ahorra cada reporte de competencia generado (preparar y analizar a mano). */
export const MINUTOS_POR_REPORTE = 20;
export const DIAS_SIN_ENTRAR_ALERTA = 14;

export interface EstudianteBitacora {
  nombre: string;
  activo: boolean;
  /** Última actividad (ms) o null. */
  ultimaActividad: number | null;
  maestria: number;
}

export interface CursoBitacora {
  cursoId: string;
  nombre: string;
  estudiantes: EstudianteBitacora[];
  /** Quices completados por la clase en la semana. */
  quicesSemana: number;
  /** Mundo con menor maestría promedio (con datos), si hay. */
  mundoMasDificil: { nombre: string; maestria: number } | null;
  asignacionesActivas: number;
}

export interface AlertaBitacora {
  cursoId: string;
  cursoNombre: string;
  nombre: string;
  diasSinEntrar: number | null;
}

export type TonoBitacora = 'celebra' | 'normal' | 'preocupada' | 'dormida';

export interface Bitacora {
  semana: string;
  generadaAt: number;
  cursos: number;
  estudiantes: number;
  activosSemana: number;
  /** 0..1 */
  pctActivos: number;
  quicesSemana: number;
  minutosAhorrados: number;
  alertas: AlertaBitacora[];
  mundoMasDificil: { cursoNombre: string; nombre: string; maestria: number } | null;
  /** Sugerencia de siguiente paso para el botón principal. */
  siguientePaso: 'crear_clase' | 'invitar' | 'asignar' | 'revisar_alertas' | 'reforzar_mundo';
  tono: TonoBitacora;
}

export function construirBitacora(
  cursos: CursoBitacora[],
  semana: string,
  ahora: number
): Bitacora {
  const desdeSemana = ahora - 7 * DIA_MS;
  const limiteAlerta = ahora - DIAS_SIN_ENTRAR_ALERTA * DIA_MS;
  let estudiantes = 0;
  let activosSemana = 0;
  let quices = 0;
  const alertas: AlertaBitacora[] = [];
  let dificil: Bitacora['mundoMasDificil'] = null;

  for (const c of cursos) {
    quices += c.quicesSemana;
    for (const e of c.estudiantes) {
      if (!e.activo) continue;
      estudiantes += 1;
      if (e.ultimaActividad !== null && e.ultimaActividad >= desdeSemana) activosSemana += 1;
      if (e.ultimaActividad === null || e.ultimaActividad < limiteAlerta) {
        alertas.push({
          cursoId: c.cursoId,
          cursoNombre: c.nombre,
          nombre: e.nombre,
          diasSinEntrar:
            e.ultimaActividad === null ? null : Math.floor((ahora - e.ultimaActividad) / DIA_MS),
        });
      }
    }
    if (c.mundoMasDificil && (dificil === null || c.mundoMasDificil.maestria < dificil.maestria)) {
      dificil = { cursoNombre: c.nombre, ...c.mundoMasDificil };
    }
  }

  const pctActivos = estudiantes === 0 ? 0 : activosSemana / estudiantes;
  const reportes = cursos.filter((c) => c.estudiantes.some((e) => e.activo)).length;
  const minutosAhorrados = quices * MINUTOS_POR_QUIZ + (quices > 0 ? reportes * MINUTOS_POR_REPORTE : 0);
  const asignaciones = cursos.reduce((n, c) => n + c.asignacionesActivas, 0);

  let siguientePaso: Bitacora['siguientePaso'];
  if (cursos.length === 0) siguientePaso = 'crear_clase';
  else if (estudiantes === 0) siguientePaso = 'invitar';
  else if (alertas.length > 0 && alertas.length >= estudiantes * 0.25) siguientePaso = 'revisar_alertas';
  else if (dificil !== null && dificil.maestria < 0.6) siguientePaso = 'reforzar_mundo';
  else if (asignaciones === 0) siguientePaso = 'asignar';
  else siguientePaso = 'asignar';

  let tono: TonoBitacora;
  if (estudiantes === 0 || activosSemana === 0) tono = 'dormida';
  else if (pctActivos >= 0.8) tono = 'celebra';
  else if (pctActivos < 0.5) tono = 'preocupada';
  else tono = 'normal';

  alertas.sort((a, b) => (b.diasSinEntrar ?? Infinity) - (a.diasSinEntrar ?? Infinity));

  return {
    semana,
    generadaAt: ahora,
    cursos: cursos.length,
    estudiantes,
    activosSemana,
    pctActivos,
    quicesSemana: quices,
    minutosAhorrados,
    alertas,
    mundoMasDificil: dificil,
    siguientePaso,
    tono,
  };
}

/** '2 h 40 min' / '35 min'. */
export function formatoMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
