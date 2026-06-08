import {
  LIFE_PROJECT_TEMPLATES,
  monthsToReach,
  suggestMonthly,
} from '@features/savings/data/lifeProjects';

describe('monthsToReach', () => {
  it('rounds up the months of contributions to cover the remaining amount', () => {
    expect(monthsToReach(1000, 0, 100)).toBe(10);
    expect(monthsToReach(1000, 250, 100)).toBe(8); // ceil(750/100)
    expect(monthsToReach(1000, 0, 300)).toBe(4); // ceil(1000/300)
  });

  it('returns 0 when the goal is already reached or exceeded', () => {
    expect(monthsToReach(1000, 1000, 100)).toBe(0);
    expect(monthsToReach(1000, 1200, 100)).toBe(0);
  });

  it('returns null when the monthly contribution is not positive', () => {
    expect(monthsToReach(1000, 0, 0)).toBeNull();
    expect(monthsToReach(1000, 0, -50)).toBeNull();
  });
});

describe('suggestMonthly', () => {
  it('splits the remaining amount across the horizon (default 12 months)', () => {
    expect(suggestMonthly(1200, 0)).toBe(100);
    expect(suggestMonthly(1000, 400)).toBe(50); // ceil(600/12)
  });

  it('is 0 when already reached and never negative', () => {
    expect(suggestMonthly(500, 500)).toBe(0);
    expect(suggestMonthly(500, 900)).toBe(0);
  });

  it('honours a custom horizon', () => {
    expect(suggestMonthly(600, 0, 6)).toBe(100);
    expect(suggestMonthly(1000, 0, 0)).toBe(1000); // no horizon → whole remaining
  });
});

describe('LIFE_PROJECT_TEMPLATES', () => {
  it('have unique ids, positive targets and an i18n title key', () => {
    const ids = LIFE_PROJECT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tpl of LIFE_PROJECT_TEMPLATES) {
      expect(tpl.suggestedTarget).toBeGreaterThan(0);
      expect(tpl.titleKey.startsWith('goals.')).toBe(true);
      expect(tpl.emoji.length).toBeGreaterThan(0);
    }
  });
});
