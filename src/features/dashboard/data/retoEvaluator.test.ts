import {
  evaluarReto,
  type DiarioLocal,
  type RetoConsigna,
} from '@features/dashboard/data/retoEvaluator';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';
import type { SavingsGoal } from '@features/savings/store/useSavingsStore';
import type { SavingsOperation } from '@features/savings/domain/savings';

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

function operation(p: Partial<SavingsOperation>): SavingsOperation {
  return {
    id: `op_${Math.random()}`,
    type: 'aporte',
    goalId: 'g1',
    amount: 100,
    description: '',
    fecha: noonJul(15),
    createdAt: noonJul(15),
    updatedAt: noonJul(15),
    ...p,
  };
}

const vacio: DiarioLocal = { movimientos: [], goals: [], operations: [] };

describe('evaluarReto — registrar_movimientos', () => {
  it('devuelve solo estado y avance locales, sin identidad ni coordenadas tenant', () => {
    const movimientos = [mov({}), mov({})];
    const result = evaluarReto(reto({ cantidad: 2 }), { ...vacio, movimientos });
    expect(result).toEqual({ estado: 'cumplido', avance: 2 });
    expect(Object.keys(result).sort()).toEqual(['avance', 'estado']);
  });

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
    const operations = [operation({}), operation({ type: 'retiro' })];
    expect(
      evaluarReto(reto({ tipo: 'registrar_ahorros', cantidad: 2 }), { ...vacio, operations })
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
    const operations = [
      operation({ fecha: noonJul(14) }),
      operation({ goalId: undefined, fecha: noonJul(14) }),
    ];
    expect(
      evaluarReto(reto({ tipo: 'abonar_meta', cantidad: 2 }), { ...vacio, operations })
    ).toEqual({
      estado: 'en_progreso',
      avance: 1,
    });
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
