import { buildWorldProgress } from '@features/learning/data/worldProgress';
import { competenciaForWorld } from '@features/learning/data/competencias';

const base = {
  colegioId: 'A',
  cursoId: 'c1',
  uid: 's1',
  worldId: 'world_3' as const,
  xp: 120,
  nivel: 2,
  now: 1000,
};

describe('buildWorldProgress', () => {
  it('populates competencia from the world mapping and denormalized keys', () => {
    const p = buildWorldProgress({ ...base, correct: 8, total: 10 });
    expect(p.competencia).toBe(competenciaForWorld('world_3').id);
    expect(p.colegioId).toBe('A');
    expect(p.cursoId).toBe('c1');
    expect(p.uid).toBe('s1');
  });

  it('marks completed and stamps completedAt at/above mastery threshold', () => {
    const p = buildWorldProgress({ ...base, correct: 8, total: 10 });
    expect(p.mastery).toBe(0.8);
    expect(p.completed).toBe(true);
    expect(p.completedAt).toBe(1000);
    expect(p.updatedAt).toBe(1000);
  });

  it('is not completed below threshold and omits completedAt', () => {
    const p = buildWorldProgress({ ...base, correct: 5, total: 10 });
    expect(p.mastery).toBe(0.5);
    expect(p.completed).toBe(false);
    expect(p.completedAt).toBeUndefined();
  });

  it('defaults quizScores and badges', () => {
    const p = buildWorldProgress({ ...base, correct: 0, total: 0 });
    expect(p.quizScores).toEqual({});
    expect(p.badges).toEqual([]);
    expect(p.mastery).toBe(0);
  });
});
