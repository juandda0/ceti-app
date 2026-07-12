import {
  decidirEscritura,
  type RetoAsignado,
  type RetoCoords,
} from '@features/dashboard/data/retoSync';
import type { DiarioLocal } from '@features/dashboard/data/retoEvaluator';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

const noonJul = (d: number) => Date.UTC(2026, 6, d, 17, 0, 0);
const NOW = noonJul(18);
const coords: RetoCoords = { colegioId: 'col1', cursoId: 'cur1', uid: 'stu1' };

function reto(p: Partial<RetoAsignado>): RetoAsignado {
  return {
    id: 'a1',
    tipo: 'registrar_movimientos',
    cantidad: 3,
    fechaInicio: noonJul(13),
    deadline: noonJul(20),
    ...p,
  };
}

function mov(): Movimiento {
  return {
    id: `mov_${Math.random()}`,
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'otros',
    origen: 'voz',
    createdAt: noonJul(15),
    fecha: noonJul(15),
  };
}

const diarioCon = (n: number): DiarioLocal => ({
  movimientos: Array.from({ length: n }, () => mov()),
  goals: [],
  deposits: [],
});

describe('decidirEscritura', () => {
  it('sin_empezar → no escribe', () => {
    expect(decidirEscritura(reto({}), diarioCon(0), null, coords, NOW)).toBeNull();
  });

  it('en_progreso desde desconocido → escribe sin cumplidoAt', () => {
    const doc = decidirEscritura(reto({}), diarioCon(2), null, coords, NOW);
    expect(doc).toEqual({
      colegioId: 'col1',
      cursoId: 'cur1',
      uid: 'stu1',
      retoId: 'a1',
      estado: 'en_progreso',
      updatedAt: NOW,
    });
  });

  it('cumplido → escribe con cumplidoAt', () => {
    const doc = decidirEscritura(reto({ cantidad: 3 }), diarioCon(3), 'en_progreso', coords, NOW);
    expect(doc?.estado).toBe('cumplido');
    expect(doc?.cumplidoAt).toBe(NOW);
  });

  it('no degrada cumplido → en_progreso', () => {
    expect(decidirEscritura(reto({}), diarioCon(2), 'cumplido', coords, NOW)).toBeNull();
  });

  it('no reescribe el mismo estado', () => {
    expect(decidirEscritura(reto({}), diarioCon(2), 'en_progreso', coords, NOW)).toBeNull();
  });

  it('el payload jamás lleva monto/categoria/descripcion (solo estado+timestamps)', () => {
    const doc = decidirEscritura(reto({ cantidad: 3 }), diarioCon(3), null, coords, NOW);
    expect(Object.keys(doc ?? {}).sort()).toEqual([
      'colegioId',
      'cumplidoAt',
      'cursoId',
      'estado',
      'retoId',
      'uid',
      'updatedAt',
    ]);
  });
});
