import {
  MASTERY_THRESHOLD,
  computeMastery,
  isMastered,
  masteryPercent,
} from '@features/learning/data/mastery';

describe('mastery', () => {
  it('computeMastery returns correct/total clamped to 0..1', () => {
    expect(computeMastery(0, 0)).toBe(0);
    expect(computeMastery(5, 10)).toBe(0.5);
    expect(computeMastery(10, 10)).toBe(1);
    expect(computeMastery(15, 10)).toBe(1); // clamped
    expect(computeMastery(-1, 10)).toBe(0); // clamped
  });

  it('isMastered respects the threshold and requires questions', () => {
    expect(isMastered(0, 0)).toBe(false);
    const atThreshold = Math.ceil(MASTERY_THRESHOLD * 10);
    expect(isMastered(atThreshold, 10)).toBe(true);
    expect(isMastered(atThreshold - 1, 10)).toBe(false);
  });

  it('masteryPercent is a 0..100 integer', () => {
    expect(masteryPercent(1, 3)).toBe(33);
    expect(masteryPercent(10, 10)).toBe(100);
    expect(masteryPercent(0, 0)).toBe(0);
  });
});
