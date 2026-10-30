import {
  armarNiveles,
  ganaCofre,
  maestriaJefe,
  tieneCofre,
  nodosMapa,
  validarMapa,
  type MapaMundo,
  type PoolMundo,
} from './niveles';
import type {
  MultipleChoiceItem,
  OrdenarItem,
  TrueFalseItem,
} from '@features/learning/data/quiz.types';

const mc = (n: number): MultipleChoiceItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `mc${i}`,
    tipo: 'multiple_choice',
    enunciado: '',
    competencia: '',
    dificultad: (i % 3) + 1,
    opciones: ['a', 'b'],
    correctIndex: 0,
  }));
const vf = (n: number): TrueFalseItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `vf${i}`,
    tipo: 'true_false',
    enunciado: '',
    competencia: '',
    dificultad: 1,
    respuesta: true,
  }));
const ord = (n: number): OrdenarItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `or${i}`,
    tipo: 'ordenar',
    enunciado: '',
    competencia: '',
    dificultad: 2,
    elementos: ['a', 'b'],
    ordenCanonico: [0, 1],
  }));

describe('niveles', () => {
  const pool: PoolMundo = { mc: mc(8), vf: vf(6), ordenar: ord(6) };

  it('arma 4 lecciones de 5 y un jefe 4+3+3 con el banco por defecto', () => {
    const n = armarNiveles(pool, 'uid1');
    expect(n.lecciones).toHaveLength(4);
    expect(n.lecciones.every((l) => l.length === 5)).toBe(true);
    expect(n.jefe).toHaveLength(10);
    expect(n.jefe.filter((q) => q.tipo === 'multiple_choice')).toHaveLength(4);
    // Todas las preguntas del banco aparecen en alguna lección.
    expect(new Set(n.lecciones.flat().map((q) => q.id)).size).toBe(20);
  });

  it('es determinista por estudiante', () => {
    expect(armarNiveles(pool, 'a')).toEqual(armarNiveles(pool, 'a'));
    expect(armarNiveles(pool, 'a').jefe).not.toEqual(armarNiveles(pool, 'zz').jefe);
  });

  it('un mundo propio mínimo (4+3+3) da 2 lecciones', () => {
    const n = armarNiveles({ mc: mc(4), vf: vf(3), ordenar: ord(3) }, 'x');
    expect(n.lecciones).toHaveLength(2);
    expect(n.jefe).toHaveLength(10);
  });

  it('sin banco suficiente no arma nada', () => {
    expect(armarNiveles({ mc: mc(2), vf: vf(3), ordenar: ord(3) }, 'x').jefe).toHaveLength(0);
  });

  it('pinta el mapa en orden', () => {
    expect(nodosMapa(3, 1, false).map((n) => n.estado)).toEqual([
      'hecho',
      'actual',
      'bloqueado',
      'bloqueado',
    ]);
    expect(nodosMapa(3, 3, false)[3].estado).toBe('actual');
    expect(nodosMapa(3, 0, true).every((n) => n.estado === 'hecho')).toBe(true);
  });

  it('la maestría del jefe es el puntaje real', () => {
    expect(maestriaJefe(10, 8)).toBe(0.8);
  });

  it('solo la primera lección y el jefe tienen cofre', () => {
    expect(tieneCofre('leccion', 1, 4)).toBe(true);
    expect(tieneCofre('leccion', 0, 4)).toBe(false);
    expect(tieneCofre('leccion', 3, 4)).toBe(false);
    expect(tieneCofre('leccion', 2, 5)).toBe(true);
    expect(tieneCofre('leccion', 2, 6)).toBe(true);
    expect(tieneCofre('leccion', 0, 1)).toBe(true);
    expect(tieneCofre('jefe', 4, 4)).toBe(true);
  });

  it('el cofre se entrega solo la primera vez que se gana', () => {
    expect(ganaCofre('leccion', 1, 4, 1, false, false)).toBe(true);
    expect(ganaCofre('leccion', 1, 4, 3, false, false)).toBe(false);
    expect(ganaCofre('leccion', 0, 4, 0, false, false)).toBe(false);
    expect(ganaCofre('jefe', 4, 4, 4, false, true)).toBe(true);
    expect(ganaCofre('jefe', 4, 4, 4, false, false)).toBe(false);
    expect(ganaCofre('jefe', 4, 4, 4, true, true)).toBe(false);
    expect(ganaCofre('leccion', 1, 4, 1, true, true)).toBe(false);
  });
});

describe('mapa del profe', () => {
  const pool: PoolMundo = { mc: mc(8), vf: vf(6), ordenar: ord(6) };
  const jefe = ['mc0', 'mc1', 'mc2', 'mc3', 'vf0', 'vf1', 'vf2', 'or0', 'or1', 'or2'];
  const mapa: MapaMundo = {
    lecciones: [{ preguntas: ['mc7', 'vf5', 'or5'] }, { preguntas: ['mc6', 'mc5', 'vf4', 'or4'] }],
    jefe,
  };

  it('usa las lecciones y el jefe del profe, en su orden', () => {
    const n = armarNiveles(pool, 'ana', mapa);
    expect(n.lecciones.map((l) => l.map((q) => q.id))).toEqual([
      ['mc7', 'vf5', 'or5'],
      ['mc6', 'mc5', 'vf4', 'or4'],
    ]);
    expect(n.jefe.map((q) => q.id)).toEqual(jefe);
  });

  it('valida: lecciones cortas, repetidas, preguntas que ya no existen y el jefe 4+3+3', () => {
    expect(validarMapa(mapa, pool)).toBeNull();
    expect(validarMapa({ ...mapa, lecciones: [] }, pool)).toBe('sin_lecciones');
    expect(validarMapa({ ...mapa, lecciones: [{ preguntas: ['mc7', 'vf5'] }] }, pool)).toBe(
      'leccion_corta'
    );
    expect(validarMapa({ ...mapa, lecciones: [{ preguntas: ['mc7', 'mc7', 'vf5'] }] }, pool)).toBe(
      'pregunta_repetida'
    );
    expect(
      validarMapa({ ...mapa, lecciones: [{ preguntas: ['mc7', 'vf5', 'borrada'] }] }, pool)
    ).toBe('pregunta_desconocida');
    expect(validarMapa({ ...mapa, jefe: jefe.slice(1) }, pool)).toBe('jefe_incompleto');
    expect(validarMapa({ ...mapa, jefe: [...jefe.slice(0, 9), 'mc4'] }, pool)).toBe(
      'jefe_incompleto'
    );
  });

  it('un mapa que ya no calza con el banco cae al armado automático', () => {
    const viejo = { ...mapa, lecciones: [{ preguntas: ['borrada', 'mc7', 'vf5'] }] };
    expect(armarNiveles(pool, 'ana', viejo)).toEqual(armarNiveles(pool, 'ana'));
  });
});
