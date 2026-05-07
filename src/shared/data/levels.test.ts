import { getLevelForXP, getLevelProgress, LEVELS } from '@shared/data/levels';

describe('levels', () => {
  it('getLevelForXP devuelve nivel 1 para XP bajo', () => {
    expect(getLevelForXP(0).level).toBe(1);
    expect(getLevelForXP(99).level).toBe(1);
  });

  it('asciende según umbrales', () => {
    expect(getLevelForXP(100).level).toBe(2);
    expect(getLevelForXP(750).level).toBe(4);
    expect(getLevelForXP(5000).level).toBe(LEVELS[LEVELS.length - 1].level);
  });

  it('getLevelProgress está entre 0 y 1', () => {
    expect(getLevelProgress(50)).toBeGreaterThanOrEqual(0);
    expect(getLevelProgress(50)).toBeLessThanOrEqual(1);
    expect(getLevelProgress(150)).toBeGreaterThan(0);
  });
});
