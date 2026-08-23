import { ritmoMeta } from '@features/savings/data/ritmoMeta';
import type { SavingsGoal, SavingsOperation } from '@features/savings/domain/savings';

const NOW = Date.UTC(2026, 6, 15, 17, 0, 0);
const DIA = 24 * 60 * 60 * 1000;

function goal(p: Partial<SavingsGoal>): SavingsGoal {
  return {
    id: 'g1',
    title: 'Tenis',
    iconId: 'target',
    targetAmount: 120000,
    createdAt: NOW - 60 * DIA,
    updatedAt: NOW - 60 * DIA,
    category: 'custom',
    ...p,
  };
}

function operation(p: Partial<SavingsOperation>): SavingsOperation {
  return {
    id: `op_${Math.random()}`,
    type: 'aporte',
    goalId: 'g1',
    amount: 45000,
    description: '',
    fecha: NOW - 10 * DIA,
    createdAt: NOW - 10 * DIA,
    updatedAt: NOW - 10 * DIA,
    ...p,
  };
}

describe('ritmoMeta', () => {
  it('promedia depósitos de la ventana de 90 días y proyecta meses', () => {
    const operations = [operation({ fecha: NOW - 10 * DIA }), operation({ fecha: NOW - 20 * DIA })];
    expect(ritmoMeta(goal({}), operations, NOW)).toEqual({ ritmoMensual: 30000, mesesAlRitmo: 1 });
  });

  it('excluye depósitos fuera de la ventana', () => {
    const operations = [operation({ amount: 100000, fecha: NOW - 100 * DIA })];
    expect(ritmoMeta(goal({}), operations, NOW)).toEqual({ ritmoMensual: 0, mesesAlRitmo: null });
  });

  it('excluye depósitos de otra meta', () => {
    const operations = [operation({ goalId: 'g2', amount: 50000 })];
    expect(ritmoMeta(goal({}), operations, NOW)).toEqual({ ritmoMensual: 0, mesesAlRitmo: null });
  });

  it('sin depósitos → ritmo 0 y sin proyección', () => {
    expect(ritmoMeta(goal({}), [], NOW)).toEqual({ ritmoMensual: 0, mesesAlRitmo: null });
  });

  it('meta ya cumplida → 0 meses', () => {
    expect(ritmoMeta(goal({}), [operation({ amount: 130000 })], NOW).mesesAlRitmo).toBe(0);
  });
});
