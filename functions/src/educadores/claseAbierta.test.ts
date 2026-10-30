jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler?: unknown) => handler ?? _options,
  HttpsError: class HttpsError extends Error {
    code: string;
    details: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));
jest.mock('firebase-functions/params', () => ({ defineSecret: () => ({ value: () => '' }), defineString: () => ({ value: () => '' }) }));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => {
    throw new Error('usa la base falsa');
  },
  FieldValue: { serverTimestamp: () => 'ts', increment: (n: number) => ({ __incremento: n }) },
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));

// eslint-disable-next-line import/first
import type { Firestore } from 'firebase-admin/firestore';
// eslint-disable-next-line import/first
import { nuevaSuscripcion, rubricaInicial } from './dominio';
// eslint-disable-next-line import/first
import { aDoc } from './plan';
// eslint-disable-next-line import/first
import { calificarEnClase, entregarEnClase, gestionarTareaEnClase, muroEnClase, sugerirEnClase } from './claseAbierta';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const AHORA = Date.now();
const K = 'colegios/c1/cursos/k1';
const profe = (uid: string) => ({ uid, token: { role: 'profesor', colegioId: 'c1' } }) as never;
const est = (uid: string) => ({ uid, token: { role: 'estudiante', clases: { k1: 'c1' } } }) as never;

function base() {
  const f = new FirestoreFalso({
    [K]: { nombre: '9°A', profesorUids: ['pEd', 'pCal', 'pCad'], soloCalificar: ['pCal'] },
    [`${K}/estudiantes/ana`]: { nombre: 'Ana Ruiz', estado: 'activo' },
    [`${K}/estudiantes/beto`]: { nombre: 'Beto Gil', estado: 'pendiente_atestacion' },
    'suscripciones/pEd': aDoc(nuevaSuscripcion('pEd', AHORA)),
  });
  return { f, db: f as unknown as Firestore };
}
const codigo = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return ((e as { details?: { codigo?: string } }).details?.codigo ?? (e as { code?: string }).code) as string;
  }
};
const tarea = { titulo: 'Tu presupuesto', consigna: 'Arma un presupuesto.', rubrica: rubricaInicial(), deadline: AHORA + 86_400_000 };

describe('tareas abiertas (F9)', () => {
  test('crear, entregar, calificar y sugerir', async () => {
    const { f, db } = base();
    expect(await codigo(gestionarTareaEnClase(db, profe('pCal'), { cursoId: 'k1', accion: 'crear', tarea }, AHORA))).toBe('solo_califica');
    const { id } = await gestionarTareaEnClase(db, profe('pEd'), { cursoId: 'k1', accion: 'crear', tarea }, AHORA);
    expect(f.datos(`${K}/tareasAbiertas/${id}`)).toMatchObject({ titulo: 'Tu presupuesto', estado: 'abierta', creadaPor: 'pEd' });

    expect(await codigo(entregarEnClase(db, est('beto'), { cursoId: 'k1', tareaId: id, texto: 'x' }, AHORA))).toBe('permission-denied');
    await entregarEnClase(db, est('ana'), { cursoId: 'k1', tareaId: id, texto: '  Ahorro 15 %  ' }, AHORA);
    expect(f.datos(`${K}/tareasAbiertas/${id}/entregas/ana`)).toMatchObject({ texto: 'Ahorro 15 %', calificada: false });

    // Quien solo ve y califica sí califica.
    const r = await calificarEnClase(db, profe('pCal'), { cursoId: 'k1', tareaId: id, uid: 'ana', niveles: [2, 3], comentario: 'Bien' }, AHORA);
    expect(r.calificacion).toMatchObject({ puntos: 7, total: 8, nota: 4.5, calificadaPor: 'pCal' });
    expect(await codigo(entregarEnClase(db, est('ana'), { cursoId: 'k1', tareaId: id, texto: 'otra' }, AHORA))).toBe('failed-precondition');
    expect(await codigo(calificarEnClase(db, profe('pCal'), { cursoId: 'k1', tareaId: id, uid: 'ana', niveles: [2] }, AHORA))).toBe('invalid-argument');

    const s = await sugerirEnClase(db, profe('pEd'), { cursoId: 'k1', tareaId: id, uid: 'ana' }, async (_sys, texto) => {
      expect(texto).toContain('Ahorro 15 %');
      expect(texto).not.toContain('Ana');
      return JSON.stringify({ criterios: [{ nivel: 2, porque: 'Cuadra.' }, { nivel: 1, porque: 'Explica poco.' }] });
    });
    expect(s.sugerencia).toEqual([
      { nivel: 2, porque: 'Cuadra.' },
      { nivel: 1, porque: 'Explica poco.' },
    ]);
    expect(await codigo(sugerirEnClase(db, profe('pEd'), { cursoId: 'k1', tareaId: id, uid: 'ana' }, async () => 'no es json'))).toBe('unavailable');

    await gestionarTareaEnClase(db, profe('pEd'), { cursoId: 'k1', accion: 'cerrar', tareaId: id }, AHORA);
    expect(f.datos(`${K}/tareasAbiertas/${id}`)?.estado).toBe('cerrada');
  });

  test('crear pide Piloto', async () => {
    const { db } = base();
    expect(await codigo(gestionarTareaEnClase(db, profe('pCad'), { cursoId: 'k1', accion: 'crear', tarea }, AHORA))).toBe('requiere_plan');
  });
});

describe('muro de preguntas (F9)', () => {
  test('apagado, preguntar, límites y moderar', async () => {
    const { f, db } = base();
    const nombre = async () => 'Profe Carolina';
    expect(await codigo(muroEnClase(db, est('ana'), { cursoId: 'k1', accion: 'preguntar', texto: '¿Qué es un CDT?' }, { ahora: AHORA }))).toBe('apagado');
    expect(await codigo(muroEnClase(db, profe('pCal'), { cursoId: 'k1', accion: 'configurar', activo: true }, { ahora: AHORA }))).toBe('solo_califica');
    await muroEnClase(db, profe('pEd'), { cursoId: 'k1', accion: 'configurar', activo: true }, { ahora: AHORA });

    const { id } = (await muroEnClase(db, est('ana'), { cursoId: 'k1', accion: 'preguntar', texto: '¿Qué es un CDT?' }, { ahora: AHORA })) as { id: string };
    expect(f.datos(`${K}/muro/${id}`)).toMatchObject({ uid: 'ana', nombre: 'Ana', estado: 'pendiente' });
    await muroEnClase(db, est('ana'), { cursoId: 'k1', accion: 'preguntar', texto: 'Dos' }, { ahora: AHORA });
    await muroEnClase(db, est('ana'), { cursoId: 'k1', accion: 'preguntar', texto: 'Tres' }, { ahora: AHORA });
    expect(await codigo(muroEnClase(db, est('ana'), { cursoId: 'k1', accion: 'preguntar', texto: 'Cuatro' }, { ahora: AHORA }))).toBe('pendientes');
    expect(await codigo(muroEnClase(db, est('beto'), { cursoId: 'k1', accion: 'preguntar', texto: 'Hola' }, { ahora: AHORA }))).toBe('permission-denied');

    // Quien solo ve y califica responde (y así se publica).
    await muroEnClase(db, profe('pCal'), { cursoId: 'k1', accion: 'responder', id, respuesta: 'Un ahorro a plazo fijo.' }, { ahora: AHORA, nombre });
    expect(f.datos(`${K}/muro/${id}`)).toMatchObject({ estado: 'publicada', respuesta: 'Un ahorro a plazo fijo.', respondidaPorNombre: 'Profe Carolina' });
    await muroEnClase(db, profe('pEd'), { cursoId: 'k1', accion: 'ocultar', id }, { ahora: AHORA });
    expect(f.datos(`${K}/muro/${id}`)?.estado).toBe('oculta');
    expect(await codigo(muroEnClase(db, est('ana'), { cursoId: 'k1', accion: 'ocultar', id }, { ahora: AHORA }))).toBe('permission-denied');
  });
});
