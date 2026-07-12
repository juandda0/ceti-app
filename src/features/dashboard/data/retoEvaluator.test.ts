import {
  evaluarReto,
  type DiarioLocal,
  type RetoConsigna,
} from '@features/dashboard/data/retoEvaluator';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';
import type { SavingsDeposit, SavingsGoal } from '@features/savings/store/useSavingsStore';

const noonJul = (d: number) => Date.UTC(2026, 6, d, 17, 0, 0);
const INICIO = noonJul(13);
const DEADLINE = noonJul(20);

function reto(p: Partial<RetoConsigna>): RetoConsigna {
  return {
    tipo: 'registrar_movimientos',
    cantidad: 5,
    fechaInicio: INICIO,
    deadline: DEADLINE,
    ...p,
  };
}

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: `mov_${Math.random()}`,
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'otros',
    origen: 'voz',
    createdAt: noonJul(15),
    fecha: noonJul(15),
    ...p,
  };
}

function goal(createdAt: number): SavingsGoal {
  return {
    id: `g_${Math.random()}`,
    title: 't',
    description: '',
    emoji: '🎯',
    targetAmount: 1000,
    currentAmount: 0,
    frequency: 'total',
    createdAt,
    category: 'custom',
  };
}

function dep(p: Partial<SavingsDeposit>): SavingsDeposit {
  return {
    id: `d_${Math.random()}`,
    goalId: 'g1',
    amount: 100,
    description: '',
    createdAt: noonJul(15),
    ...p,
  };
}

const vacio: DiarioLocal = { movimientos: [], goals: [], deposits: [] };

describe('evaluarReto — registrar_movimientos', () => {
  it('sin registros → sin_empezar', () => {
    expect(evaluarReto(reto({}), vacio)).toEqual({ estado: 'sin_empezar', avance: 0 });
  });
  it('avance parcial → en_progreso', () => {
    const movimientos = [mov({}), mov({}), mov({})];
    expect(evaluarReto(reto({}), { ...vacio, movimientos })).toEqual({
      estado: 'en_progreso',
      avance: 3,
    });
  });
  it('llega a la cantidad → cumplido (avance tope en cantidad)', () => {
    const movimientos = Array.from({ length: 6 }, () => mov({}));
    expect(evaluarReto(reto({ cantidad: 5 }), { ...vacio, movimientos })).toEqual({
      estado: 'cumplido',
      avance: 5,
    });
  });
  it('ignora movimientos fuera de la ventana', () => {
    const movimientos = [
      mov({ fecha: noonJul(15) }),
      mov({ fecha: noonJul(1) }),
      mov({ fecha: noonJul(25) }),
    ];
    expect(evaluarReto(reto({}), { ...vacio, movimientos })).toEqual({
      estado: 'en_progreso',
      avance: 1,
    });
  });
});

describe('evaluarReto — otros tipos', () => {
  it('registrar_ahorros solo cuenta ahorros', () => {
    const movimientos = [mov({ tipo: 'ahorro' }), mov({ tipo: 'gasto' }), mov({ tipo: 'gasto' })];
    expect(
      evaluarReto(reto({ tipo: 'registrar_ahorros', cantidad: 2 }), { ...vacio, movimientos })
    ).toEqual({
      estado: 'en_progreso',
      avance: 1,
    });
  });

  it('crear_meta cuenta metas creadas en la ventana', () => {
    const goals = [goal(noonJul(14)), goal(noonJul(1))]; // la segunda fuera de ventana
    expect(evaluarReto(reto({ tipo: 'crear_meta', cantidad: 1 }), { ...vacio, goals })).toEqual({
      estado: 'cumplido',
      avance: 1,
    });
  });

  it('abonar_meta exige goalId', () => {
    const deposits = [
      dep({ createdAt: noonJul(14) }),
      dep({ goalId: undefined, createdAt: noonJul(14) }),
    ];
    expect(evaluarReto(reto({ tipo: 'abonar_meta', cantidad: 2 }), { ...vacio, deposits })).toEqual(
      {
        estado: 'en_progreso',
        avance: 1,
      }
    );
  });

  it('racha_dias cuenta días distintos, no movimientos', () => {
    const movimientos = [
      mov({ fecha: noonJul(14) }),
      mov({ fecha: noonJul(14) }),
      mov({ fecha: noonJul(15) }),
    ];
    expect(
      evaluarReto(reto({ tipo: 'racha_dias', cantidad: 3 }), { ...vacio, movimientos })
    ).toEqual({
      estado: 'en_progreso',
      avance: 2,
    });
  });

  it('cumplir_tope diferido en v1 → sin_empezar', () => {
    const movimientos = [mov({}), mov({})];
    expect(
      evaluarReto(reto({ tipo: 'cumplir_tope', cantidad: 1 }), { ...vacio, movimientos })
    ).toEqual({
      estado: 'sin_empezar',
      avance: 0,
    });
  });
});
