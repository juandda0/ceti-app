/**
 * Lo que dice Ceti en la Bitácora, según el `tono` del dominio y las cifras de
 * la semana. Y la semana en palabras ("19 – 25 oct").
 */
import type { TFunction } from 'i18next';
import { DIA_MS, fechaBogota, type Bitacora } from '@/functions/src/educadores/dominio';
import type { AnimationId } from '@features/animations';

export function vozCeti(t: TFunction, b: Bitacora): string {
  const datos = {
    activos: b.activosSemana,
    total: b.estudiantes,
    faltan: b.estudiantes - b.activosSemana,
  };
  if (b.cursos === 0) return t('educadores.bitacora.voz.sinClases');
  if (b.estudiantes === 0) return t('educadores.bitacora.voz.sinTripulantes');
  switch (b.tono) {
    case 'celebra':
      return datos.faltan === 0
        ? t('educadores.bitacora.voz.celebraTodos', datos)
        : t('educadores.bitacora.voz.celebra', datos);
    case 'preocupada':
      return t('educadores.bitacora.voz.preocupada', datos);
    case 'dormida':
      return t('educadores.bitacora.voz.dormida', datos);
    default:
      return t('educadores.bitacora.voz.normal', datos);
  }
}

export function animacionDeTono(tono: Bitacora['tono']): AnimationId {
  if (tono === 'preocupada') return 'mascot.ceti-triste';
  if (tono === 'dormida') return 'mascot.ceti-idle';
  return 'mascot.ceti-vuelo-reposo';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function corta(fecha: string): { dia: number; mes: string } {
  return { dia: Number(fecha.slice(8, 10)), mes: MESES[Number(fecha.slice(5, 7)) - 1] };
}

/** Lunes a domingo de la semana de `ms` (hora de Bogotá): "19 – 25 oct" o "27 oct – 2 nov". */
export function rangoSemana(ms: number): string {
  const hoy = fechaBogota(ms);
  const dow = new Date(`${hoy}T00:00:00.000Z`).getUTCDay() || 7;
  const lunesMs = Date.parse(`${hoy}T12:00:00.000Z`) - (dow - 1) * DIA_MS;
  const lunes = corta(new Date(lunesMs).toISOString().slice(0, 10));
  const domingo = corta(new Date(lunesMs + 6 * DIA_MS).toISOString().slice(0, 10));
  return lunes.mes === domingo.mes
    ? `${lunes.dia} – ${domingo.dia} ${domingo.mes}`
    : `${lunes.dia} ${lunes.mes} – ${domingo.dia} ${domingo.mes}`;
}
