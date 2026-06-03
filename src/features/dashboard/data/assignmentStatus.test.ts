import { assignmentStatus, daysUntil } from '@features/dashboard/data/assignmentStatus';

const DAY = 24 * 60 * 60 * 1000;
const a = { fechaInicio: 1000, deadline: 1000 + 7 * DAY };

describe('assignmentStatus', () => {
  it('done overrides everything when completed', () => {
    expect(assignmentStatus(a, 5_000_000_000, true)).toBe('done');
  });
  it('upcoming before start', () => {
    expect(assignmentStatus(a, 500, false)).toBe('upcoming');
  });
  it('active between start and deadline', () => {
    expect(assignmentStatus(a, 1000 + 3 * DAY, false)).toBe('active');
  });
  it('overdue after deadline', () => {
    expect(assignmentStatus(a, 1000 + 8 * DAY, false)).toBe('overdue');
  });
});

describe('daysUntil', () => {
  it('counts whole days remaining', () => {
    expect(daysUntil(1000 + 7 * DAY, 1000)).toBe(7);
  });
  it('is negative when overdue', () => {
    expect(daysUntil(1000, 1000 + 2 * DAY)).toBe(-2);
  });
});
