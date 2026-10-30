/**
 * Fase 9 — calendario de la clase. Junta lo que ya tiene fecha: tareas y
 * tareas abiertas (vencen), mundos que se abren por requisito, la prueba de
 * entrada y salida, las clases en vivo hechas y el cierre de cada periodo del
 * SIEE. Se agrupa por semanas (en el celular se lee mejor que una cuadrícula)
 * y se puede bajar como .ics para Google Calendar u Outlook. Puro.
 */
import { DIA_MS, fechaBogota, inicioDiaBogota, semanaIso } from './calendario';
import type { PeriodoConNombre } from './evaluacion';

export type TipoEvento = 'tarea' | 'tareaAbierta' | 'mundo' | 'prueba' | 'vivo' | 'periodo';

export interface EventoClase {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  /** Instante del evento (vencimiento, apertura o fin). */
  en: number;
  /** Para abrir lo que corresponde: worldId, id de tarea… */
  ref?: string;
}

export interface FuentesCalendario {
  tareas?: { id: string; titulo: string; deadline: number }[];
  tareasAbiertas?: { id: string; titulo: string; deadline: number | null }[];
  mundosConFecha?: { worldId: string; nombre: string; desde: string }[];
  prueba?: { pre?: { abiertaAt?: number | null; cerradaAt?: number | null } | null; post?: { abiertaAt?: number | null; cerradaAt?: number | null } | null } | null;
  vivo?: { id: string; titulo: string; creadoAt: number }[];
  periodos?: PeriodoConNombre[];
}

/** Ventana por defecto: dos semanas atrás y cuatro meses adelante. */
export const DIAS_ATRAS = 14;
export const DIAS_ADELANTE = 120;

export function eventosDeClase(f: FuentesCalendario, ahora: number): EventoClase[] {
  const ev: EventoClase[] = [];
  for (const t of f.tareas ?? []) ev.push({ id: `tarea_${t.id}`, tipo: 'tarea', titulo: t.titulo, en: t.deadline, ref: t.id });
  for (const t of f.tareasAbiertas ?? []) {
    if (t.deadline) ev.push({ id: `abierta_${t.id}`, tipo: 'tareaAbierta', titulo: t.titulo, en: t.deadline, ref: t.id });
  }
  for (const m of f.mundosConFecha ?? []) {
    ev.push({ id: `mundo_${m.worldId}`, tipo: 'mundo', titulo: m.nombre, en: inicioDiaBogota(m.desde), ref: m.worldId });
  }
  for (const fase of ['pre', 'post'] as const) {
    const p = f.prueba?.[fase];
    if (p?.abiertaAt) ev.push({ id: `prueba_${fase}_abre`, tipo: 'prueba', titulo: `${fase}:abre`, en: p.abiertaAt, ref: fase });
    if (p?.cerradaAt) ev.push({ id: `prueba_${fase}_cierra`, tipo: 'prueba', titulo: `${fase}:cierra`, en: p.cerradaAt, ref: fase });
  }
  for (const v of f.vivo ?? []) ev.push({ id: `vivo_${v.id}`, tipo: 'vivo', titulo: v.titulo, en: v.creadoAt, ref: v.id });
  for (const p of f.periodos ?? []) {
    // El cierre es el último día del periodo (fin del día en Bogotá).
    ev.push({ id: `periodo_${p.desde.slice(0, 4)}_${p.numero}`, tipo: 'periodo', titulo: p.nombre, en: inicioDiaBogota(p.hasta) + DIA_MS - 1 });
  }
  const desde = ahora - DIAS_ATRAS * DIA_MS;
  const hasta = ahora + DIAS_ADELANTE * DIA_MS;
  return ev.filter((e) => e.en >= desde && e.en <= hasta).sort((a, b) => a.en - b.en || a.id.localeCompare(b.id));
}

export type GrupoSemana = 'pasado' | 'estaSemana' | 'proximaSemana' | 'despues';

/** Agrupa por semana ISO (hora de Bogotá), en orden y sin grupos vacíos. */
export function porSemana(eventos: readonly EventoClase[], ahora: number): { grupo: GrupoSemana; eventos: EventoClase[] }[] {
  const esta = semanaIso(ahora);
  const proxima = semanaIso(ahora + 7 * DIA_MS);
  const grupoDe = (e: EventoClase): GrupoSemana => {
    const s = semanaIso(e.en);
    if (s === esta) return 'estaSemana';
    if (s === proxima) return 'proximaSemana';
    return e.en < ahora ? 'pasado' : 'despues';
  };
  const orden: GrupoSemana[] = ['pasado', 'estaSemana', 'proximaSemana', 'despues'];
  return orden
    .map((grupo) => ({ grupo, eventos: eventos.filter((e) => grupoDe(e) === grupo) }))
    .filter((g) => g.eventos.length > 0);
}

function escaparIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Corta las líneas a 75 caracteres (RFC 5545 §3.1). */
function plegar(linea: string): string {
  const partes: string[] = [];
  let resto = linea;
  while (resto.length > 75) {
    partes.push(resto.slice(0, 75));
    resto = ' ' + resto.slice(75);
  }
  partes.push(resto);
  return partes.join('\r\n');
}

/**
 * Archivo .ics con eventos de día completo. `titulo` ya traducido por la app
 * (la prueba y el periodo se nombran allá).
 */
export function icsDeEventos(
  eventos: readonly { id: string; titulo: string; en: number }[],
  nombreClase: string,
  cursoId: string,
  ahora: number
): string {
  const sello = new Date(ahora).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ceti//Calendario de la clase//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escaparIcs(`Ceti · ${nombreClase}`)}`,
    'X-WR-TIMEZONE:America/Bogota',
  ];
  for (const e of eventos) {
    const dia = fechaBogota(e.en).replace(/-/g, '');
    const siguiente = fechaBogota(inicioDiaBogota(fechaBogota(e.en)) + DIA_MS).replace(/-/g, '');
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${e.id}.${cursoId}@ceti.app`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${dia}`,
      `DTEND;VALUE=DATE:${siguiente}`,
      `SUMMARY:${escaparIcs(e.titulo)}`,
      'END:VEVENT'
    );
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}
