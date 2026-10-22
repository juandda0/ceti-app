/**
 * Aritmética de días para Órbita. Todo trabaja con claves `YYYY-MM-DD` de Bogotá
 * (las mismas de `dayKey`), así la racha, la meta diaria y el interés de los
 * lunes no dependen de la zona horaria del teléfono. Puro.
 */
import { dayKey } from '@features/savings/data/periodos';

const DIA_MS = 24 * 60 * 60 * 1000;

export { dayKey };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Número de día absoluto (días desde 1970-01-01) de una clave `YYYY-MM-DD`. */
export function indiceDia(clave: string): number {
  const [y, m, d] = clave.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DIA_MS);
}

export function claveDeIndice(indice: number): string {
  const f = new Date(indice * DIA_MS);
  return `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`;
}

export function sumarDias(clave: string, n: number): string {
  return claveDeIndice(indiceDia(clave) + n);
}

/** Días de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return indiceDia(hasta) - indiceDia(desde);
}

/** Lunes de la semana de `clave` (las semanas de Ceti empiezan el lunes). */
export function lunesDe(clave: string): string {
  const i = indiceDia(clave);
  const diaSemana = (new Date(i * DIA_MS).getUTCDay() + 6) % 7; // lunes = 0
  return claveDeIndice(i - diaSemana);
}

/** Días estrictamente entre `a` y `b` (sin incluir ninguno de los dos). */
export function diasIntermedios(a: string, b: string): string[] {
  const out: string[] = [];
  for (let i = indiceDia(a) + 1; i < indiceDia(b); i++) out.push(claveDeIndice(i));
  return out;
}
