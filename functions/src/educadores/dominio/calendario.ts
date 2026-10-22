/**
 * Fechas en hora de Colombia (UTC-5, sin horario de verano), festivos
 * colombianos (Ley 51 de 1983, "Ley Emiliani"), días hábiles para el derecho de
 * retracto (Ley 1480 de 2011, art. 47) y el calendario escolar A. Puro.
 */

export const DIA_MS = 24 * 60 * 60 * 1000;
const OFFSET_BOGOTA_MS = -5 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' de un instante, en hora de Bogotá. */
export function fechaBogota(ms: number): string {
  return new Date(ms + OFFSET_BOGOTA_MS).toISOString().slice(0, 10);
}

/** Instante de las 00:00 de Bogotá para 'YYYY-MM-DD'. */
export function inicioDiaBogota(fecha: string): number {
  return Date.parse(`${fecha}T00:00:00.000Z`) - OFFSET_BOGOTA_MS;
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sumarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DIA_MS);
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
export function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(anio, mes, dia);
}

/** Traslada al lunes siguiente si no cae en lunes (Ley Emiliani). */
function alLunes(d: Date): Date {
  const dow = d.getUTCDay();
  return dow === 1 ? d : sumarDias(d, (8 - dow) % 7);
}

const cacheFestivos = new Map<number, Set<string>>();

/** Festivos de Colombia del año, como 'YYYY-MM-DD'. */
export function festivosColombia(anio: number): Set<string> {
  const cached = cacheFestivos.get(anio);
  if (cached) return cached;
  const pascua = domingoDePascua(anio);
  const fechas: Date[] = [
    utc(anio, 1, 1),
    utc(anio, 5, 1),
    utc(anio, 7, 20),
    utc(anio, 8, 7),
    utc(anio, 12, 8),
    utc(anio, 12, 25),
    alLunes(utc(anio, 1, 6)),
    alLunes(utc(anio, 3, 19)),
    alLunes(utc(anio, 6, 29)),
    alLunes(utc(anio, 8, 15)),
    alLunes(utc(anio, 10, 12)),
    alLunes(utc(anio, 11, 1)),
    alLunes(utc(anio, 11, 11)),
    sumarDias(pascua, -3),
    sumarDias(pascua, -2),
    alLunes(sumarDias(pascua, 39)),
    alLunes(sumarDias(pascua, 60)),
    alLunes(sumarDias(pascua, 68)),
  ];
  const set = new Set(fechas.map(iso));
  cacheFestivos.set(anio, set);
  return set;
}

export function esDiaHabil(fecha: string): boolean {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !festivosColombia(d.getUTCFullYear()).has(fecha);
}

/**
 * Último instante en que se puede ejercer el retracto: 5 días hábiles contados
 * desde el día siguiente a la compra, hasta el fin de ese quinto día (Bogotá).
 */
export function finRetracto(compraMs: number, diasHabiles = 5): number {
  let d = new Date(`${fechaBogota(compraMs)}T00:00:00.000Z`);
  let contados = 0;
  while (contados < diasHabiles) {
    d = sumarDias(d, 1);
    if (esDiaHabil(iso(d))) contados += 1;
  }
  return inicioDiaBogota(iso(sumarDias(d, 1))) - 1;
}

/** Suma meses calendario conservando el día (se ajusta al último día del mes). */
export function sumarMeses(ms: number, meses: number): number {
  const d = new Date(ms);
  const dia = d.getUTCDate();
  const destino = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + meses,
      1,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    )
  );
  const ultimo = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)
  ).getUTCDate();
  destino.setUTCDate(Math.min(dia, ultimo));
  return destino.getTime();
}

/** Semana ISO 'YYYY-Www' del instante (hora de Bogotá). */
export function semanaIso(ms: number): string {
  const d = new Date(`${fechaBogota(ms)}T00:00:00.000Z`);
  const dow = d.getUTCDay() || 7;
  const jueves = sumarDias(d, 4 - dow);
  const anio = jueves.getUTCFullYear();
  const inicioAnio = utc(anio, 1, 1);
  const semana = Math.ceil(((jueves.getTime() - inicioAnio.getTime()) / DIA_MS + 1) / 7);
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

/**
 * Vacaciones largas del calendario A: del 1 de diciembre al 31 de enero. Si
 * `ms` cae en noviembre, diciembre o enero, devuelve el 1 de febrero en que
 * vuelven las clases (00:00 Bogotá). Si no, null.
 */
export function regresoAClases(ms: number): number | null {
  const fecha = fechaBogota(ms);
  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  if (mes === 11 || mes === 12) return inicioDiaBogota(`${anio + 1}-02-01`);
  if (mes === 1) return inicioDiaBogota(`${anio}-02-01`);
  return null;
}

export interface Periodo {
  numero: number;
  /** 'YYYY-MM-DD' inclusive. */
  desde: string;
  hasta: string;
}

/**
 * Cuatro periodos aproximados del calendario A (Decreto 1290 deja el número y
 * las fechas al SIEE de cada colegio; esto es solo el valor por defecto).
 */
export function periodosCalendarioA(anio: number): Periodo[] {
  return [
    { numero: 1, desde: `${anio}-02-01`, hasta: `${anio}-04-15` },
    { numero: 2, desde: `${anio}-04-16`, hasta: `${anio}-06-30` },
    { numero: 3, desde: `${anio}-07-01`, hasta: `${anio}-09-15` },
    { numero: 4, desde: `${anio}-09-16`, hasta: `${anio}-11-30` },
  ];
}

/** Periodo en curso (o el último que terminó, en vacaciones). */
export function periodoActual(ms: number, periodos?: Periodo[]): Periodo {
  const fecha = fechaBogota(ms);
  const anio = Number(fecha.slice(0, 4));
  const lista = periodos ?? periodosCalendarioA(anio);
  const dentro = lista.find((p) => p.desde <= fecha && fecha <= p.hasta);
  if (dentro) return dentro;
  const pasados = lista.filter((p) => p.hasta < fecha);
  if (pasados.length > 0) return pasados[pasados.length - 1];
  // Enero: el último periodo del año anterior.
  const previos = periodos ?? periodosCalendarioA(anio - 1);
  return previos[previos.length - 1];
}
