import { WORLD_COMPETENCIAS, competenciaForWorld } from '@features/learning/data/competencias';
import type { WorldId } from '@features/learning/data/quiz.types';

const WORLD_IDS: WorldId[] = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];

describe('competencias', () => {
  it('maps every world to a competency', () => {
    for (const w of WORLD_IDS) {
      expect(competenciaForWorld(w)).toBeDefined();
      expect(competenciaForWorld(w).id).toBeTruthy();
      expect(competenciaForWorld(w).label).toBeTruthy();
    }
  });

  it('has unique competency ids (stable keys for reports)', () => {
    const ids = WORLD_IDS.map((w) => WORLD_COMPETENCIAS[w].id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
