import { filtrarBanco, limpiarTemas, type PreguntaGuardada } from './bancoProfe';

const p = (
  id: string,
  enunciado: string,
  temas: string[],
  tipo: PreguntaGuardada['tipo'] = 'multiple_choice',
  creadoAt = 0
): PreguntaGuardada => ({
  id,
  item: { id, tipo: 'true_false', enunciado, competencia: 'x', dificultad: 1, respuesta: true },
  tipo,
  temas,
  origen: null,
  creadoAt,
});

describe('mi banco', () => {
  it('limpia los temas', () => {
    expect(limpiarTemas([' Ahorro ', 'ahorro', '', 'Interés  compuesto'])).toEqual([
      'Ahorro',
      'Interés compuesto',
    ]);
    expect(limpiarTemas(Array.from({ length: 15 }, (_, i) => `t${i}`))).toHaveLength(10);
  });

  it('filtra por texto, tema y tipo; lo más nuevo primero', () => {
    const banco = [
      p('a', '¿Qué es un CDT?', ['Ahorro'], 'multiple_choice', 1),
      p('b', 'El interés se suma', ['Interés'], 'true_false', 2),
      p('c', 'Une conceptos', ['Ahorro', 'Deuda'], 'emparejar', 3),
    ];
    expect(filtrarBanco(banco, { tema: 'Ahorro' }).map((x) => x.id)).toEqual(['c', 'a']);
    expect(filtrarBanco(banco, { texto: 'cdt' }).map((x) => x.id)).toEqual(['a']);
    expect(filtrarBanco(banco, { texto: 'deuda' }).map((x) => x.id)).toEqual(['c']);
    expect(filtrarBanco(banco, { tipo: 'true_false' }).map((x) => x.id)).toEqual(['b']);
  });
});
