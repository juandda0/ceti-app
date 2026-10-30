import {
  calificar,
  criterioVacio,
  leerSugerencia,
  leerTarea,
  notaDeRubrica,
  puntajeMaximo,
  resumenTarea,
  rubricaInicial,
  textoParaIa,
} from './rubricas';

const ahora = 1_800_000_000_000;
const base = { titulo: 'Tu presupuesto', consigna: 'Arma un presupuesto con $200.000.', rubrica: rubricaInicial(), deadline: ahora + 86_400_000 };

describe('tareas abiertas con rúbrica (F9)', () => {
  it('valida la tarea', () => {
    expect(leerTarea(base, ahora)).toMatchObject({ ok: true, tarea: { titulo: 'Tu presupuesto', worldId: null } });
    expect(leerTarea({ ...base, titulo: '' }, ahora)).toEqual({ ok: false, error: 'titulo' });
    expect(leerTarea({ ...base, rubrica: { criterios: [criterioVacio('Uno')] } }, ahora)).toEqual({ ok: false, error: 'criterios' });
    expect(leerTarea({ ...base, rubrica: { criterios: [criterioVacio('Uno'), criterioVacio('')] } }, ahora)).toEqual({
      ok: false,
      error: 'criterio_nombre',
    });
    const malos = criterioVacio('Dos');
    malos.niveles[2].puntos = 1;
    expect(leerTarea({ ...base, rubrica: { criterios: [criterioVacio('Uno'), malos] } }, ahora)).toEqual({ ok: false, error: 'puntos' });
    expect(leerTarea({ ...base, deadline: ahora - 3_600_000 }, ahora)).toEqual({ ok: false, error: 'fecha' });
  });

  it('puntos y nota en la escala', () => {
    const r = rubricaInicial();
    expect(puntajeMaximo(r)).toBe(8);
    expect(notaDeRubrica(8, 8)).toBe(5);
    expect(notaDeRubrica(0, 8)).toBe(1);
    expect(notaDeRubrica(6, 8)).toBe(4);
    const c = calificar(r, [2, 3], '  Bien  ', 'p', ahora);
    expect(c).toMatchObject({ niveles: [2, 3], puntos: 7, total: 8, nota: 4.5, comentario: 'Bien', calificadaPor: 'p' });
    expect(calificar(r, [2, null], '', 'p', ahora)).toBeNull();
    expect(calificar(r, [2, 7], '', 'p', ahora)).toBeNull();
  });

  it('resumen de la tarea', () => {
    expect(resumenTarea([{ calificacion: { nota: 4 } as never }, { calificacion: null }, { calificacion: { nota: 3 } as never }])).toEqual({
      entregas: 3,
      calificadas: 2,
      sinCalificar: 1,
      promedio: 3.5,
    });
  });

  it('la IA solo sugiere un nivel válido por criterio', () => {
    const texto = textoParaIa(base, 'Ahorro $30.000');
    expect(texto).toContain('CRITERIO 2: Explica su decisión');
    expect(texto).toContain('nivel 3 (Superior)');
    expect(leerSugerencia({ criterios: [{ nivel: 2, porque: 'Cuadra.' }, { nivel: 0, porque: 'No explica.' }] }, 2)).toEqual([
      { nivel: 2, porque: 'Cuadra.' },
      { nivel: 0, porque: 'No explica.' },
    ]);
    expect(leerSugerencia({ criterios: [{ nivel: 4 }, { nivel: 0 }] }, 2)).toBeNull();
    expect(leerSugerencia({ criterios: [{ nivel: 1 }] }, 2)).toBeNull();
    expect(leerSugerencia('nada', 2)).toBeNull();
  });
});
