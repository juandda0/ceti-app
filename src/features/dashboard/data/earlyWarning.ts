/**
 * Rule-based early-warning (V3) — NO ML. Flags ACTIVE students who need a nudge,
 * using only data already on the course report: no activity at all, stalled
 * (no recent progress), and/or below the mastery threshold. Complements the
 * weakness report (which is mastery-only) by surfacing inactivity early. Pure.
 */
import { MASTERY_THRESHOLD } from '@features/learning/data/mastery';
import type { CourseReport } from '@features/dashboard/data/courseReport';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_DAYS = 14;

export type RiskFlag = 'no_activity' | 'stalled' | 'low_mastery';

export interface StudentRisk {
  uid: string;
  nombre: string;
  flags: RiskFlag[];
  level: 'high' | 'medium';
  lastActivity: number | null;
  overallMastery: number;
}

export interface EarlyWarningReport {
  staleDays: number;
  atRisk: StudentRisk[];
}

export function buildEarlyWarning(
  report: CourseReport,
  now: number,
  opts?: { staleDays?: number; threshold?: number }
): EarlyWarningReport {
  const staleDays = opts?.staleDays ?? DEFAULT_STALE_DAYS;
  const threshold = opts?.threshold ?? MASTERY_THRESHOLD;
  const staleBefore = now - staleDays * DAY_MS;

  const atRisk: StudentRisk[] = report.students
    .filter((s) => s.estado === 'activo')
    .map((s) => {
      const hasData = Object.keys(s.masteryByCompetencia).length > 0;
      const flags: RiskFlag[] = [];
      if (s.lastActivity == null) flags.push('no_activity');
      else if (s.lastActivity < staleBefore) flags.push('stalled');
      if (hasData && s.overallMastery < threshold) flags.push('low_mastery');

      const high =
        flags.includes('no_activity') ||
        (flags.includes('stalled') && flags.includes('low_mastery'));

      return {
        uid: s.uid,
        nombre: s.nombre,
        flags,
        level: high ? ('high' as const) : ('medium' as const),
        lastActivity: s.lastActivity,
        overallMastery: s.overallMastery,
      };
    })
    .filter((r) => r.flags.length > 0)
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === 'high' ? -1 : 1;
      // Oldest activity first; "no activity" (null) sorts before everything.
      return (a.lastActivity ?? -Infinity) - (b.lastActivity ?? -Infinity);
    });

  return { staleDays, atRisk };
}
