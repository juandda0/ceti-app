import { isGoalIconId } from '@features/savings/icons/GoalIcon';

describe('GoalIcon', () => {
  it('acepta solo el catálogo SVG cerrado', () => {
    expect(isGoalIconId('bike')).toBe(true);
    expect(isGoalIconId('https://example.com/a.svg')).toBe(false);
  });
});
