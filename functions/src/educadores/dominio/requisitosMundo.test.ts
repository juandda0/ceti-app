import { inicioDiaBogota } from './calendario';
import { aperturaPorFecha, faltantesRequisitos, leerRequisitos } from './requisitosMundo';

const ctx = (over: Partial<Parameters<typeof faltantesRequisitos>[1]> = {}) => ({
  ahora: inicioDiaBogota('2026-11-05'),
  visibles: new Set(['world_1', 'world_2']),
  conquistado: (w: string) => w === 'world_1',
  maestria: (w: string) => (w === 'world_1' ? 0.5 : null), // nota 3,0
  ...over,
});

describe('requisitos para abrir un mundo (F9)', () => {
  it('lee y limpia', () => {
    expect(leerRequisitos(null)).toBeNull();
    expect(leerRequisitos({})).toBeNull();
    expect(leerRequisitos({ desde: '2026-13-40' })).toBeNull();
    expect(leerRequisitos({ desde: '2026-11-10', despuesDe: 'world_1', notaMinima: 3.46 })).toEqual({
      desde: '2026-11-10',
      despuesDe: 'world_1',
      notaMinima: 3.5,
    });
    // Nota sin mundo, o fuera de la escala, no aplica.
    expect(leerRequisitos({ desde: '2026-11-10', notaMinima: 4 })).toEqual({ desde: '2026-11-10', despuesDe: null, notaMinima: null });
    expect(leerRequisitos({ despuesDe: 'world_1', notaMinima: 9 })?.notaMinima).toBeNull();
  });

  it('fecha: se abre ese día a las 00:00 de Bogotá', () => {
    expect(faltantesRequisitos({ desde: '2026-11-06' }, ctx())).toEqual([{ tipo: 'fecha', desde: '2026-11-06' }]);
    expect(faltantesRequisitos({ desde: '2026-11-05' }, ctx())).toEqual([]);
    expect(aperturaPorFecha({ desde: '2026-11-06' })).toBe(inicioDiaBogota('2026-11-06'));
  });

  it('mundo anterior y nota mínima', () => {
    expect(faltantesRequisitos({ despuesDe: 'world_2' }, ctx())).toEqual([{ tipo: 'mundo', worldId: 'world_2' }]);
    expect(faltantesRequisitos({ despuesDe: 'world_1', notaMinima: 3 }, ctx())).toEqual([]);
    expect(faltantesRequisitos({ despuesDe: 'world_1', notaMinima: 3.5 }, ctx())).toEqual([
      { tipo: 'nota', worldId: 'world_1', minima: 3.5, actual: 3 },
    ]);
    expect(faltantesRequisitos({ despuesDe: 'world_2', notaMinima: 3 }, ctx())).toEqual([
      { tipo: 'mundo', worldId: 'world_2' },
      { tipo: 'nota', worldId: 'world_2', minima: 3, actual: null },
    ]);
  });

  it('un mundo que ya no está en la clase no bloquea', () => {
    expect(faltantesRequisitos({ despuesDe: 'cw_borrado', notaMinima: 4 }, ctx())).toEqual([]);
  });

  it('combina todo', () => {
    expect(faltantesRequisitos({ desde: '2026-12-01', despuesDe: 'world_1', notaMinima: 4 }, ctx()).map((f) => f.tipo)).toEqual([
      'fecha',
      'nota',
    ]);
  });
});
