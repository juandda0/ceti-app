/** Fecha calendario local YYYY-MM-DD (no UTC) para rachas diarias. */
export function getLocalCalendarYMD(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getLocalCalendarYMDDaysAgo(days: number): string {
  const t = new Date();
  t.setDate(t.getDate() - days);
  return getLocalCalendarYMD(t);
}

/** Etiquetas cortas domingo → sábado (semana que empieza en domingo, estilo Duolingo). */
export const WEEKDAY_LABELS_SUN_START_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as const;

export interface WeekDayCell {
  ymd: string;
  /** 0 = domingo … 6 = sábado */
  dowSun0: number;
  isToday: boolean;
}

/** Los 7 días de la semana calendario actual (domingo inicio), hora local. */
export function getCurrentWeekDaysSunStart(anchor: Date = new Date()): WeekDayCell[] {
  const todayYmd = getLocalCalendarYMD(anchor);
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const sunOffset = d.getDay();
  d.setDate(d.getDate() - sunOffset);

  const out: WeekDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const ymd = getLocalCalendarYMD(d);
    out.push({
      ymd,
      dowSun0: i,
      isToday: ymd === todayYmd,
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** YMD de hace `days` días (para podar historial). */
export function getLocalCalendarYMDDaysBefore(daysBefore: number): string {
  const t = new Date();
  t.setDate(t.getDate() - daysBefore);
  return getLocalCalendarYMD(t);
}
