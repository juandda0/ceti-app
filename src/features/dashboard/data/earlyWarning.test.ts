import { buildCourseReport, type RosterEntry } from '@features/dashboard/data/courseReport';
import { buildEarlyWarning } from '@features/dashboard/data/earlyWarning';
import type { WorldProgress } from '@shared/types/tenancy';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

function prog(uid: string, mastery: number, updatedAt: number): WorldProgress {
  return {
    colegioId: 'A',
    cursoId: 'c1',
    uid,
    competencia: 'ahorro',
    xp: 0,
    nivel: 0,
    mastery,
    quizScores: {},
    badges: [],
    completed: mastery >= 0.8,
    updatedAt,
  };
}

const roster: RosterEntry[] = [
  { uid: 's1', nombre: 'No activity', estado: 'activo' },
  { uid: 's2', nombre: 'Stalled + low', estado: 'activo' },
  { uid: 's3', nombre: 'Stalled ok', estado: 'activo' },
  { uid: 's4', nombre: 'Recent low', estado: 'activo' },
  { uid: 's5', nombre: 'Recent ok', estado: 'activo' },
  { uid: 's6', nombre: 'Pending', estado: 'pendiente_atestacion' },
];

function report() {
  return buildCourseReport({
    colegioId: 'A',
    cursoId: 'c1',
    cursoNombre: '9A',
    now: NOW,
    roster,
    progress: [
      // s1: none
      prog('s2', 0.4, NOW - 20 * DAY),
      prog('s3', 0.9, NOW - 20 * DAY),
      prog('s4', 0.4, NOW - 1 * DAY),
      prog('s5', 0.9, NOW - 1 * DAY),
      prog('s6', 0.1, NOW - 30 * DAY),
    ],
  });
}

describe('buildEarlyWarning', () => {
  it('flags no-activity / stalled / low-mastery for active students only', () => {
    const w = buildEarlyWarning(report(), NOW);
    const ids = w.atRisk.map((r) => r.uid);
    expect(ids).not.toContain('s5'); // recent + good → fine
    expect(ids).not.toContain('s6'); // pendiente → not considered active
    const s1 = w.atRisk.find((r) => r.uid === 's1')!;
    expect(s1.flags).toEqual(['no_activity']);
    expect(s1.level).toBe('high');
    const s2 = w.atRisk.find((r) => r.uid === 's2')!;
    expect(s2.flags).toEqual(['stalled', 'low_mastery']);
    expect(s2.level).toBe('high');
    const s3 = w.atRisk.find((r) => r.uid === 's3')!;
    expect(s3.flags).toEqual(['stalled']);
    expect(s3.level).toBe('medium');
    const s4 = w.atRisk.find((r) => r.uid === 's4')!;
    expect(s4.flags).toEqual(['low_mastery']);
    expect(s4.level).toBe('medium');
  });

  it('sorts high risk first, then oldest activity', () => {
    const w = buildEarlyWarning(report(), NOW);
    expect(w.atRisk.map((r) => r.uid)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('respects a custom stale window', () => {
    // With a 60-day window, s2/s3 (20 days old) are no longer stalled.
    const w = buildEarlyWarning(report(), NOW, { staleDays: 60 });
    const s3 = w.atRisk.find((r) => r.uid === 's3');
    expect(s3).toBeUndefined(); // ok mastery + not stalled → no flags
    const s2 = w.atRisk.find((r) => r.uid === 's2')!;
    expect(s2.flags).toEqual(['low_mastery']); // still low, but no longer stalled
  });
});
