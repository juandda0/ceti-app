import { avanceDeTarea } from './avanceTarea';
import type { AsignacionAny } from '@shared/types/tenancy';

const base = { fechaInicio: 0, deadline: 100, createdByUid: 'p1', createdAt: 0 };
const mundo = (target: AsignacionAny['target']): AsignacionAny => ({
  worldId: 'cw_ahorro',
  target,
  ...base,
});
const prog = (uid: string, worldId: string, completed: boolean, completedAt?: number) => ({
  uid,
  worldId,
  completed,
  completedAt,
});

describe('avanceDeTarea', () => {
  it('cuenta hechas y tarde entre quienes siguen en la clase', () => {
    const r = avanceDeTarea(
      mundo({ tipo: 'curso', cursoId: 'k' }),
      ['a', 'b', 'c'],
      [
        prog('a', 'cw_ahorro', true, 50),
        prog('b', 'cw_ahorro', true, 150),
        prog('c', 'cw_ahorro', false),
        prog('d', 'cw_ahorro', true, 10), // ya no está en la clase
        prog('c', 'world_1', true, 10), // otro mundo
      ]
    );
    expect(r).toEqual({ total: 3, hechas: 2, tarde: 1 });
  });

  it('una tarea individual solo mide a ese estudiante', () => {
    const t = mundo({ tipo: 'estudiante', cursoId: 'k', uid: 'b' });
    expect(avanceDeTarea(t, ['a', 'b'], [prog('a', 'cw_ahorro', true, 1)])).toEqual({
      total: 1,
      hechas: 0,
      tarde: 0,
    });
    expect(avanceDeTarea(t, ['a'], [])).toEqual({ total: 0, hechas: 0, tarde: 0 });
  });

  it('los retos no se miden (su avance es privado)', () => {
    const reto: AsignacionAny = {
      kind: 'reto',
      reto: { tipo: 'crear_meta', cantidad: 1 },
      target: { tipo: 'curso', cursoId: 'k' },
      ...base,
    };
    expect(avanceDeTarea(reto, ['a'], [])).toBeNull();
  });
});
