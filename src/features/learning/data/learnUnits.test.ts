import { LEARN_UNITS } from '@features/learning/data/learnUnits';

describe('learnUnits', () => {
  it('expone al menos una unidad con id y título', () => {
    expect(LEARN_UNITS.length).toBeGreaterThanOrEqual(1);
    const first = LEARN_UNITS[0];
    expect(first.id).toBeTruthy();
    expect(first.title).toBeTruthy();
  });
});
