import {
  emparejarCompleto,
  errorItemExtra,
  esCompletarCorrecto,
  esEmparejarCorrecto,
  esNumericaCorrecta,
  fraseCompletada,
  leerNumero,
  ordenDerecha,
} from './tiposExtra';
import type { CompletarItem, EmparejarItem, NumericaItem } from './quiz.types';

const base = { competencia: 'ahorro', dificultad: 2 };
const empa: EmparejarItem = {
  ...base,
  id: 'e1',
  tipo: 'emparejar',
  enunciado: 'Une cada concepto',
  pares: [
    { izquierda: 'Ahorro', derecha: 'Guardar para después' },
    { izquierda: 'Deuda', derecha: 'Lo que debes' },
    { izquierda: 'Ingreso', derecha: 'Lo que recibes' },
  ],
};
const comp: CompletarItem = {
  ...base,
  id: 'c1',
  tipo: 'completar',
  enunciado: 'El ___ es plata que guardas.',
  opciones: ['gasto', 'ahorro'],
  correctIndex: 1,
};
const num: NumericaItem = {
  ...base,
  id: 'n1',
  tipo: 'numerica',
  enunciado: '¿Cuánto?',
  respuesta: 1500,
  tolerancia: 0,
  unidad: 'pesos',
};

describe('leerNumero', () => {
  it.each([
    ['1.500', 1500],
    ['1.500.000', 1500000],
    ['2,5', 2.5],
    ['1.234,56', 1234.56],
    ['$ 12.000', 12000],
    ['1500.5', 1500.5],
    ['-3', -3],
    ['15 %', 15],
    ['20 pesos', 20],
  ])('%s → %s', (t, n) => expect(leerNumero(t)).toBe(n));

  it.each(['', 'mil', '1,2,3', '--'])('"%s" no es número', (t) => expect(leerNumero(t)).toBeNull());
});

describe('corrección', () => {
  it('numérica con tolerancia', () => {
    expect(esNumericaCorrecta(num, '1.500')).toBe(true);
    expect(esNumericaCorrecta(num, '1.501')).toBe(false);
    expect(esNumericaCorrecta({ ...num, tolerancia: 5 }, '1.504')).toBe(true);
    expect(esNumericaCorrecta(num, 'mil quinientos')).toBe(false);
  });

  it('emparejar: cada izquierda con su pareja', () => {
    expect(esEmparejarCorrecto(empa, [0, 1, 2])).toBe(true);
    expect(esEmparejarCorrecto(empa, [1, 0, 2])).toBe(false);
    expect(emparejarCompleto(empa, [0, -1, 2])).toBe(false);
    expect([...ordenDerecha(empa)].sort()).toEqual([0, 1, 2]);
    expect(ordenDerecha(empa)).toEqual(ordenDerecha(empa));
  });

  it('completar', () => {
    expect(esCompletarCorrecto(comp, 1)).toBe(true);
    expect(fraseCompletada(comp, 1)).toBe('El ahorro es plata que guardas.');
    expect(fraseCompletada(comp, null)).toBe('El _____ es plata que guardas.');
  });
});

describe('errorItemExtra', () => {
  it('valida cada tipo', () => {
    expect(errorItemExtra(empa)).toBeNull();
    expect(errorItemExtra({ ...empa, pares: empa.pares.slice(0, 2) })).toBe('pares');
    expect(
      errorItemExtra({
        ...empa,
        pares: [...empa.pares.slice(0, 2), { izquierda: 'x', derecha: 'lo que debes' }],
      })
    ).toBe('par_repetido');
    expect(errorItemExtra(comp)).toBeNull();
    expect(errorItemExtra({ ...comp, enunciado: 'Sin espacio' })).toBe('sin_espacio');
    expect(errorItemExtra(num)).toBeNull();
    expect(errorItemExtra({ ...num, tolerancia: -1 })).toBe('tolerancia');
  });
});
