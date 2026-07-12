import { ritmoMeta } from '@features/savings/data/ritmoMeta';
import type { SavingsDeposit, SavingsGoal } from '@features/savings/store/useSavingsStore';

const NOW = Date.UTC(2026, 6, 15, 17, 0, 0);
const DIA = 24 * 60 * 60 * 1000;

function goal(p: Partial<SavingsGoal>): SavingsGoal {
  return {
    id: 'g1',
    title: 'Tenis',
    description: '',
    emoji: '👟',
    targetAmount: 120000,
    currentAmount: 85000,
    frequency: 'total',
    createdAt: NOW - 60 * DIA,
    category: 'custom',
    ...p,
  };
}

function dep(p: Partial<SavingsDeposit>): SavingsDeposit {
  return {
    id: `dep_${Math.random()}`,
    goalId: 'g1',
    amount: 45000,
    description: '',
    createdAt: NOW - 10 * DIA,
    ...p,
  };
}

describe('ritmoMeta', () => {
  it('promedia depósitos de la ventana de 90 días y proyecta meses', () => {
    const deposits = [dep({ createdAt: NOW - 10 * DIA }), dep({ createdAt: NOW - 20 * DIA })];
    expect(ritmoMeta(goal({}), deposits, NOW)).toEqual({ ritmoMensual: 30000, mesesAlRitmo: 2 });
  });

  it('excluye depósitos fuera de la ventana', () => {
    const deposits = [dep({ amount: 100000, createdAt: NOW - 100 * DIA })];
    expect(ritmoMeta(goal({}), deposits, NOW)).toEqual({ ritmoMensual: 0, mesesAlRitmo: null });
  });

  it('excluye depósitos de otra meta', () => {
    const deposits = [dep({ goalId: 'g2', amount: 50000 })];
    expect(ritmoMeta(goal({}), deposits, NOW)).toEqual({ ritmoMensual: 0, mesesAlRitmo: null });
  });

  it('sin depósitos → ritmo 0 y sin proyección', () => {
    expect(ritmoMeta(goal({}), [], NOW)).toEqual({ ritmoMensual: 0, mesesAlRitmo: null });
  });

  it('meta ya cumplida → 0 meses', () => {
    const g = goal({ currentAmount: 130000 });
    expect(ritmoMeta(g, [dep({})], NOW).mesesAlRitmo).toBe(0);
  });
});
