import { inicioDiaBogota } from './calendario';
import { eventosDeClase, icsDeEventos, porSemana } from './calendarioClase';

const ahora = inicioDiaBogota('2026-11-04') + 10 * 3600_000; // miércoles
const dia = (f: string) => inicioDiaBogota(f) + 12 * 3600_000;

describe('calendario de la clase (F9)', () => {
  const eventos = eventosDeClase(
    {
      tareas: [{ id: 't1', titulo: 'Bahía del Ahorro', deadline: dia('2026-11-06') }],
      tareasAbiertas: [
        { id: 'a1', titulo: 'Tu presupuesto', deadline: dia('2026-11-12') },
        { id: 'a2', titulo: 'Sin fecha', deadline: null },
      ],
      mundosConFecha: [{ worldId: 'world_3', nombre: 'Isla del Crédito', desde: '2026-11-17' }],
      prueba: { pre: { abiertaAt: dia('2026-10-28'), cerradaAt: null } },
      vivo: [{ id: 's1', titulo: 'Repaso', creadoAt: dia('2026-11-03') }],
      periodos: [
        { numero: 3, nombre: 'Periodo 3', desde: '2026-07-01', hasta: '2026-09-15' },
        { numero: 4, nombre: 'Periodo 4', desde: '2026-09-16', hasta: '2026-11-30' },
      ],
    },
    ahora
  );

  it('junta, ordena y deja fuera lo viejo y lo sin fecha', () => {
    expect(eventos.map((e) => e.id)).toEqual([
      'prueba_pre_abre',
      'vivo_s1',
      'tarea_t1',
      'abierta_a1',
      'mundo_world_3',
      'periodo_2026_4',
    ]);
    expect(eventos.find((e) => e.tipo === 'periodo')?.en).toBe(inicioDiaBogota('2026-12-01') - 1);
  });

  it('agrupa por semanas', () => {
    expect(porSemana(eventos, ahora).map((g) => [g.grupo, g.eventos.length])).toEqual([
      ['pasado', 1],
      ['estaSemana', 2],
      ['proximaSemana', 1],
      ['despues', 2],
    ]);
  });

  it('arma un .ics de día completo con texto escapado', () => {
    const ics = icsDeEventos([{ id: 'tarea_t1', titulo: 'Tarea: ahorro, gastos; todo', en: dia('2026-11-06') }], '9°A', 'k1', ahora);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261106');
    expect(ics).toContain('DTEND;VALUE=DATE:20261107');
    expect(ics).toContain('SUMMARY:Tarea: ahorro\\, gastos\\; todo');
    expect(ics).toContain('UID:tarea_t1.k1@ceti.app');
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });
});
