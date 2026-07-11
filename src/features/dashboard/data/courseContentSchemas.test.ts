import { buildOrdenarElements, canonicalElements, validateQuizItem } from './courseContentSchemas';
import type { OrdenarItem } from '@features/learning/data/quiz.types';

describe('buildOrdenarElements', () => {
  const correct = ['Recibir ingreso', 'Presupuestar', 'Ahorrar', 'Gastar'];

  it('nunca almacena los elementos en orden canónico (no filtra la respuesta)', () => {
    const { elementos, ordenCanonico } = buildOrdenarElements('q1', 'Ordena los pasos', correct);
    expect(elementos).toHaveLength(4);
    expect([...elementos].sort()).toEqual([...correct].sort());
    // La presentación almacenada NO es la secuencia correcta.
    expect(elementos).not.toEqual(correct);
    // Pero ordenCanonico la reconstruye exactamente.
    expect(ordenCanonico.map((i) => elementos[i])).toEqual(correct);
  });

  it('es determinista para el mismo id+enunciado', () => {
    const a = buildOrdenarElements('q1', 'Ordena', correct);
    const b = buildOrdenarElements('q1', 'Ordena', correct);
    expect(a).toEqual(b);
  });

  it('roundtrip con canonicalElements (forma de edición)', () => {
    const { elementos, ordenCanonico } = buildOrdenarElements('q9', 'Pasos de deuda', correct);
    const item: OrdenarItem = {
      id: 'q9',
      tipo: 'ordenar',
      enunciado: 'Pasos de deuda',
      competencia: 'deuda',
      dificultad: 2,
      elementos,
      ordenCanonico,
    };
    expect(canonicalElements(item)).toEqual(correct);
    expect(validateQuizItem(item)).toBeNull();
  });
});

describe('validateQuizItem', () => {
  it('rechaza MC con correctIndex fuera de rango', () => {
    expect(
      validateQuizItem({
        id: 'q1',
        tipo: 'multiple_choice',
        enunciado: '¿Qué es el ingreso mensual?',
        competencia: 'ingreso',
        dificultad: 1,
        opciones: ['a', 'b', 'c'],
        correctIndex: 3,
      })
    ).not.toBeNull();
  });

  it('rechaza ordenar con ordenCanonico incompleto', () => {
    expect(
      validateQuizItem({
        id: 'q2',
        tipo: 'ordenar',
        enunciado: 'Ordena estos pasos financieros',
        competencia: 'ahorro',
        dificultad: 2,
        elementos: ['a', 'b', 'c'],
        ordenCanonico: [0, 1],
      })
    ).not.toBeNull();
  });

  it('acepta un V/F válido', () => {
    expect(
      validateQuizItem({
        id: 'q3',
        tipo: 'true_false',
        enunciado: 'El presupuesto ayuda a controlar los gastos.',
        competencia: 'presupuesto',
        dificultad: 1,
        respuesta: true,
      })
    ).toBeNull();
  });
});
