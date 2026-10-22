import { armarNiveles, maestriaJefe, nodosMapa, type PoolMundo } from './niveles';
import type { MultipleChoiceItem, OrdenarItem, TrueFalseItem } from '@features/learning/data/quiz.types';

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
});
