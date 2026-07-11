import { goalStatus } from '@features/savings/data/goalStatus';

describe('goalStatus', () => {
  it('activa por defecto (sin cumplir)', () => {
    expect(goalStatus({ currentAmount: 10, targetAmount: 100 })).toBe('activa');
  });
  it('cumplida cuando alcanza el objetivo', () => {
    expect(goalStatus({ currentAmount: 100, targetAmount: 100 })).toBe('cumplida');
  });
  it('cumplida por completedAt aunque el monto baje', () => {
    expect(goalStatus({ currentAmount: 20, targetAmount: 100, completedAt: 500 })).toBe('cumplida');
  });
  it('no cumplida cuando targetAmount es 0 (evita cumplir falso)', () => {
    expect(goalStatus({ currentAmount: 0, targetAmount: 0 })).toBe('activa');
  });
});
