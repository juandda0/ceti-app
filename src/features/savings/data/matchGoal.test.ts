import { matchGoal } from '@features/savings/data/matchGoal';
import type { SavingsGoal } from '@features/savings/store/useSavingsStore';

function goal(title: string): SavingsGoal {
  return {
    id: `g_${title}`,
    title,
    description: '',
    emoji: '🎯',
    targetAmount: 100000,
    currentAmount: 0,
    frequency: 'total',
    category: 'custom',
    createdAt: 1,
  };
}

const goals = [goal('Bicicleta'), goal('Computador'), goal('Viaje a la costa')];

describe('matchGoal', () => {
  it('empareja por token parcial ("la bici" -> Bicicleta)', () => {
    expect(matchGoal('la bici', goals)?.title).toBe('Bicicleta');
  });

  it('empareja ignorando tildes y mayúsculas', () => {
    expect(matchGoal('BICICLETÁ', goals)?.title).toBe('Bicicleta');
  });

  it('empareja por inclusión ("viaje" -> Viaje a la costa)', () => {
    expect(matchGoal('viaje', goals)?.title).toBe('Viaje a la costa');
  });

  it('devuelve undefined si no hay coincidencia', () => {
    expect(matchGoal('un dragón', goals)).toBeUndefined();
  });

  it('devuelve undefined con nombre vacío o sin metas', () => {
    expect(matchGoal('', goals)).toBeUndefined();
    expect(matchGoal('bici', [])).toBeUndefined();
  });
});
