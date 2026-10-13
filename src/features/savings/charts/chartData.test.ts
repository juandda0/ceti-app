import type { Movimiento } from '@features/savings/store/useMovimientosStore';
import type { SavingsGoal, SavingsOperation } from '@features/savings/domain/savings';
import {
  constancia,
  construirFlujo,
  gastosPorCategoria,
  insightPeriodo,
  progresoMetas,
  resumenPeriodo,
  serieTemporal,
  marcasEje,
} from './chartData';

// Miércoles 14 oct 2026, 12:00 Bogotá (UTC-5). Semana: lun 12 – dom 18.
const NOW = Date.UTC(2026, 9, 14, 17, 0, 0);
const DIA = 24 * 60 * 60 * 1000;

let seq = 0;
function gasto(
  monto: number,
  fecha: number,
  categoria: Movimiento['categoria'] = 'comida'
): Movimiento {
  seq += 1;
  return {
    id: `m${seq}`,
    tipo: 'gasto',
    monto,
    descripcion: 'x',
    categoria,
    origen: 'voz',
    createdAt: fecha,
    fecha,
  };
}
function op(
  amount: number,
  fecha: number,
  type: 'aporte' | 'retiro' = 'aporte',
  goalId?: string
): SavingsOperation {
  seq += 1;
  return {
    id: `o${seq}`,
    type,
    amount,
    description: 'x',
    goalId,
    fecha,
    createdAt: fecha,
    updatedAt: fecha,
  };
}
function goal(id: string, targetAmount: number, deletedAt?: number): SavingsGoal {
  return {
    id,
    title: id,
    iconId: 'target',
    category: 'custom',
    targetAmount,
    createdAt: NOW - 100 * DIA,
    updatedAt: NOW,
    ...(deletedAt ? { deletedAt } : {}),
  };
}

describe('chartData', () => {
  it('no se rompe sin datos', () => {
    const flujo = construirFlujo([], []);
    for (const p of ['semana', 'mes', 'todo'] as const) {
      const r = resumenPeriodo(flujo, p, NOW);
      expect(r.gastado).toBe(0);
      expect(r.ahorrado).toBe(0);
      expect(insightPeriodo(r)).toEqual({ key: 'vacio' });
      expect(gastosPorCategoria([], p, NOW)).toEqual([]);
      expect(serieTemporal(flujo, p, NOW).every((c) => c.gastos === 0 && c.ahorros === 0)).toBe(
        true
      );
    }
    expect(progresoMetas([], [], NOW)).toEqual([]);
    expect(constancia([], [], NOW)).toEqual({
      racha: 0,
      semana: Array(7).fill(false),
      hoyIndex: 2,
    });
  });

  it('resume la semana y compara con la anterior', () => {
    const movs = [gasto(8000, NOW), gasto(10000, NOW - 7 * DIA)];
    const ops = [op(5000, NOW), op(1000, NOW, 'retiro')];
    const r = resumenPeriodo(construirFlujo(movs, ops), 'semana', NOW);
    expect(r).toEqual({ gastado: 8000, ahorrado: 4000, balance: -4000, gastadoAnterior: 10000 });
    expect(insightPeriodo(r)).toEqual({ key: 'menos', pct: 20 });
  });

  it('no cuenta doble un ahorro legacy ligado a una operación', () => {
    const legacy: Movimiento = { ...gasto(3000, NOW), id: 'shared', tipo: 'ahorro' };
    const o: SavingsOperation = { ...op(3000, NOW), id: 'shared' };
    expect(resumenPeriodo(construirFlujo([legacy], [o]), 'todo', NOW).ahorrado).toBe(3000);
  });

  it('agrupa por categoría ordenado con porcentajes', () => {
    const movs = [
      gasto(3000, NOW, 'ropa'),
      gasto(1000, NOW, 'comida'),
      gasto(999_999_999, NOW - 400 * DIA, 'tecnologia'),
    ];
    expect(gastosPorCategoria(movs, 'semana', NOW)).toEqual([
      { categoria: 'ropa', total: 3000, pct: 75 },
      { categoria: 'comida', total: 1000, pct: 25 },
    ]);
    expect(gastosPorCategoria(movs, 'todo', NOW)[0].categoria).toBe('tecnologia');
  });

  it('arma columnas por día, tramo del mes y últimos 6 meses', () => {
    const flujo = construirFlujo([gasto(2000, NOW), gasto(500, NOW - 2 * DIA)], [op(700, NOW)]);
    const sem = serieTemporal(flujo, 'semana', NOW);
    expect(sem.map((c) => c.label)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(sem[2]).toMatchObject({ gastos: 2000, ahorros: 700, actual: true });
    expect(sem[0].gastos).toBe(500);

    const mes = serieTemporal(flujo, 'mes', NOW);
    expect(mes.map((c) => c.label)).toEqual(['1–7', '8–14', '15–21', '22–28', '29–31']);
    expect(mes[1]).toMatchObject({ gastos: 2500, actual: true });

    const todo = serieTemporal(flujo, 'todo', NOW);
    expect(todo.map((c) => c.label)).toEqual(['may', 'jun', 'jul', 'ago', 'sep', 'oct']);
    expect(todo[5].gastos).toBe(2500);
  });

  it('progreso de metas ignora borradas y pone cumplidas al final', () => {
    const goals = [goal('a', 10000), goal('b', 1000), goal('borrada', 500, NOW)];
    const ops = [
      op(2500, NOW - DIA, 'aporte', 'a'),
      op(5000, NOW, 'aporte', 'b'),
      op(500, NOW, 'aporte', 'borrada'),
    ];
    const res = progresoMetas(goals, ops, NOW);
    expect(res.map((m) => m.id)).toEqual(['a', 'b']);
    expect(res[0]).toMatchObject({ pct: 25, restante: 7500, cumplida: false });
    expect(res[1]).toMatchObject({ pct: 100, restante: 0, cumplida: true, mesesAlRitmo: null });
  });

  it('constancia marca los días con registro de la semana', () => {
    const c = constancia([gasto(1000, NOW), gasto(1000, NOW - DIA)], [op(100, NOW - 2 * DIA)], NOW);
    expect(c.racha).toBe(3);
    expect(c.semana).toEqual([true, true, true, false, false, false, false]);
  });
});

describe('marcasEje', () => {
  it('da marcas redondas que cubren el máximo', () => {
    expect(marcasEje(0)).toEqual([0]);
    expect(marcasEje(70000)).toEqual([0, 25000, 50000, 75000]);
    expect(marcasEje(1)).toEqual([0, 0.5, 1, 1.5]);
    const big = marcasEje(987_654_321);
    expect(big[big.length - 1]).toBeGreaterThanOrEqual(987_654_321);
  });
});
