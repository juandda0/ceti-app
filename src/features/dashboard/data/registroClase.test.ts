import {
  MAX_DURACION_MS,
  MAX_RESPUESTAS_POR_INTENTO,
  construirIntento,
  cuentaComoVisita,
  diaDe,
} from './registroClase';

const respuesta = (i: number, correcta: boolean) => ({
  pregunta: `q${i}`,
  tipo: 'multiple_choice' as const,
  correcta,
  respuesta: 'x'.repeat(200),
  ms: 1500.4,
});

describe('construirIntento', () => {
  it('arma el doc del intento con aciertos y tiempos recortados', () => {
    const i = construirIntento({
      worldId: 'world_2',
      tipo: 'leccion',
      nivel: 1,
      registro: {
        resultado: 'completado',
        inicioAt: 1000,
        finAt: 31000,
        respuestas: [respuesta(1, true), respuesta(2, false), respuesta(2, true)],
      },
    });
    expect(i).toMatchObject({
      worldId: 'world_2',
      tipo: 'leccion',
      nivel: 1,
      resultado: 'completado',
      duracionMs: 30000,
      total: 3,
      aciertos: 2,
    });
    expect(i.respuestas[0]).toEqual({
      p: 'q1',
      t: 'multiple_choice',
      ok: true,
      r: 'x'.repeat(80),
      ms: 1500,
    });
  });

  it('el jefe no lleva nivel; nada pasa de los topes', () => {
    const muchas = Array.from({ length: 60 }, (_, k) => respuesta(k, false));
    const i = construirIntento({
      worldId: 'cw_x',
      tipo: 'jefe',
      nivel: 3,
      registro: {
        resultado: 'perdido',
        inicioAt: 0,
        finAt: 10 * MAX_DURACION_MS,
        respuestas: muchas,
      },
    });
    expect(i.nivel).toBeNull();
    expect(i.total).toBe(MAX_RESPUESTAS_POR_INTENTO);
    expect(i.duracionMs).toBe(MAX_DURACION_MS);
  });
});

describe('visitas', () => {
  it('día local y una visita cada 30 min', () => {
    expect(diaDe(new Date(2026, 9, 30, 23, 59).getTime())).toBe('2026-10-30');
    expect(cuentaComoVisita(null, 0)).toBe(true);
    expect(cuentaComoVisita(0, 29 * 60 * 1000)).toBe(false);
    expect(cuentaComoVisita(0, 30 * 60 * 1000)).toBe(true);
  });
});
