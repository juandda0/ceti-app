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
jest.mock('firebase-admin/firestore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incremento } = require('./firestoreFalso.test');
  return {
    getFirestore: () => {
      throw new Error('los tests pasan su propio db');
    },
    FieldValue: { increment: incremento, serverTimestamp: () => 'ts' },
  };
});

// eslint-disable-next-line import/first
import { nuevaSuscripcion, aplicarPagoAprobado, DIA_MS } from './dominio';
// eslint-disable-next-line import/first
import { aDoc, mesBogota } from './plan';
// eslint-disable-next-line import/first
import {
  asegurarCupoEstudiante,
  asegurarIaDisponible,
  asegurarPuedeCrearClase,
  bloqueoClases,
  bloqueoEstudiantes,
  bloqueoIa,
  contarRoster,
  cuposLibres,
  duenoDeCurso,
  leerLicenciaNave,
  planDeCurso,
  registrarGeneracionIa,
  usoIaDelMes,
} from './limites';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const AHORA = Date.now();
const db = (inicial: Record<string, Record<string, unknown>> = {}) =>
  new FirestoreFalso(inicial) as unknown as FirebaseFirestore.Firestore;

/** Suscripción en prueba (Piloto) o vencida (Cadete). */
const enPrueba = (uid: string) => aDoc(nuevaSuscripcion(uid, AHORA));
const vencida = (uid: string) =>
  aDoc({ ...nuevaSuscripcion(uid, AHORA - 30 * DIA_MS), estado: 'gratis' as const });
const comandante = (uid: string) =>
  aDoc(
    aplicarPagoAprobado(nuevaSuscripcion(uid, AHORA), {
      plan: 'comandante',
      ciclo: 'mensual',
      montoCop: 1,
      fundador: false,
      fuentePagoId: null,
      metodo: 'tarjeta',
      ahora: AHORA,
    })
  );

async function codigoDe(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return ((e as { details?: { codigo?: string } }).details?.codigo ?? 'sin_codigo') as string;
  }
}

describe('decisiones puras', () => {
  it('Cadete abre 1 clase; Piloto, las que quiera', () => {
    expect(bloqueoClases('cadete', 0)).toBeNull();
    expect(bloqueoClases('cadete', 1)).toMatchObject({
      tipo: 'resource-exhausted',
      codigo: 'limite_clases',
      mensaje: 'Tu plan Cadete incluye 1 clase. Pasa a Piloto para abrir más.',
    });
    expect(bloqueoClases('piloto', 25)).toBeNull();
  });

  it('el cupo de la clase sigue el plan', () => {
    expect(bloqueoEstudiantes('cadete', 44)).toBeNull();
    expect(bloqueoEstudiantes('cadete', 45)?.codigo).toBe('limite_estudiantes');
    expect(bloqueoEstudiantes('piloto', 59)).toBeNull();
    expect(cuposLibres('cadete', 40)).toBe(5);
    expect(cuposLibres('cadete', 50)).toBe(0);
  });

  it('IA: Cadete necesita plan; Piloto tiene 60 al mes', () => {
    expect(bloqueoIa('cadete', 0)).toMatchObject({
      tipo: 'failed-precondition',
      codigo: 'requiere_plan',
    });
    expect(bloqueoIa('piloto', 59)).toBeNull();
    expect(bloqueoIa('piloto', 60)).toMatchObject({
      tipo: 'resource-exhausted',
      codigo: 'limite_ia',
      limite: 60,
    });
    expect(bloqueoIa('comandante', 299)).toBeNull();
  });

  it('el dueño es el primer profe', () => {
    expect(duenoDeCurso({ profesorUids: ['a', 'b'] })).toBe('a');
    expect(duenoDeCurso({ profesorUids: [] })).toBeNull();
    expect(duenoDeCurso(undefined)).toBeNull();
  });

  it('valida la licencia Nave', () => {
    const r = leerLicenciaNave(
      { colegioId: 'col', estudiantes: 300, hastaMs: AHORA + DIA_MS, padrino: ' Banco ' },
      AHORA
    );
    expect(r).toEqual({
      colegioId: 'col',
      licencia: { plan: 'nave', hasta: AHORA + DIA_MS, estudiantes: 300, padrino: 'Banco' },
    });
    expect(
      leerLicenciaNave({ colegioId: 'col', estudiantes: 1, hastaMs: AHORA + 1 }, AHORA).licencia
        .padrino
    ).toBeNull();
    expect(() =>
      leerLicenciaNave({ colegioId: 'col', estudiantes: 0, hastaMs: AHORA + 1 }, AHORA)
    ).toThrow();
    expect(() =>
      leerLicenciaNave({ colegioId: 'col', estudiantes: 10, hastaMs: AHORA - 1 }, AHORA)
    ).toThrow();
    expect(() =>
      leerLicenciaNave({ colegioId: 'a/b', estudiantes: 10, hastaMs: AHORA + 1 }, AHORA)
    ).toThrow();
  });
});

describe('con Firestore', () => {
  it('cuenta las clases del profe y frena la segunda en Cadete', async () => {
    const base = {
      'colegios/col/cursos/c1': { profesorUids: ['p1'] },
      'colegios/col/cursos/c2': { profesorUids: ['otro'] },
    };
    expect(
      await codigoDe(
        asegurarPuedeCrearClase('p1', 'col', db({ ...base, 'suscripciones/p1': vencida('p1') }))
      )
    ).toBe('limite_clases');
    // Sin suscripción también es Cadete.
    expect(await codigoDe(asegurarPuedeCrearClase('p1', 'col', db(base)))).toBe('limite_clases');
    // En la prueba de 14 días puede abrir más.
    expect(
      await codigoDe(
        asegurarPuedeCrearClase('p1', 'col', db({ ...base, 'suscripciones/p1': enPrueba('p1') }))
      )
    ).toBeNull();
    // Primera clase: siempre.
    expect(await codigoDe(asegurarPuedeCrearClase('p2', 'col', db(base)))).toBeNull();
  });

  it('una licencia Nave vigente del colegio vale para el profe', async () => {
    const d = db({
      'colegios/col': { licencia: { plan: 'nave', hasta: AHORA + DIA_MS, estudiantes: 200 } },
      'colegios/col/cursos/c1': { profesorUids: ['p1'] },
    });
    expect(await codigoDe(asegurarPuedeCrearClase('p1', 'col', d))).toBeNull();
  });

  it('el roster no cuenta a los suprimidos', async () => {
    const d = db({
      'colegios/col/cursos/c1/estudiantes/a': { estado: 'activo' },
      'colegios/col/cursos/c1/estudiantes/b': { estado: 'pendiente_atestacion' },
      'colegios/col/cursos/c1/estudiantes/c': { estado: 'suprimido' },
    });
    expect(await contarRoster('col', 'c1', d)).toBe(2);
  });

  it('el cupo usa el plan del dueño de la clase', async () => {
    const inicial: Record<string, Record<string, unknown>> = {
      'colegios/col/cursos/c1': { profesorUids: ['dueno', 'coprofe'] },
      'suscripciones/dueno': vencida('dueno'),
      'suscripciones/coprofe': comandante('coprofe'),
    };
    for (let i = 0; i < 45; i++)
      inicial[`colegios/col/cursos/c1/estudiantes/e${i}`] = { estado: 'activo' };
    expect(await planDeCurso('col', 'c1', db(inicial))).toEqual({
      plan: 'cadete',
      duenoUid: 'dueno',
    });
    expect(await codigoDe(asegurarCupoEstudiante('col', 'c1', db(inicial)))).toBe(
      'limite_estudiantes'
    );
    inicial['suscripciones/dueno'] = enPrueba('dueno');
    expect(await codigoDe(asegurarCupoEstudiante('col', 'c1', db(inicial)))).toBeNull();
  });

  it('una clase sin profe vale la licencia del colegio', async () => {
    const d = db({
      'colegios/col': { licencia: { plan: 'nave', hasta: AHORA + DIA_MS, estudiantes: 200 } },
      'colegios/col/cursos/c1': { profesorUids: [] },
    });
    expect(await planDeCurso('col', 'c1', d)).toEqual({ plan: 'nave', duenoUid: null });
  });

  it('IA: exige plan, cuenta por mes y se frena en el límite', async () => {
    expect(
      await codigoDe(asegurarIaDisponible('p1', 'col', db({ 'suscripciones/p1': vencida('p1') })))
    ).toBe('requiere_plan');

    const falso = new FirestoreFalso({ 'suscripciones/p1': enPrueba('p1') });
    const d = falso as unknown as FirebaseFirestore.Firestore;
    expect(await asegurarIaDisponible('p1', 'col', d)).toBe('piloto');
    await registrarGeneracionIa('p1', d);
    await registrarGeneracionIa('p1', d);
    expect(await usoIaDelMes('p1', Date.now(), d)).toBe(2);
    expect(falso.datos(`suscripciones/p1/uso/${mesBogota()}`)).toMatchObject({ iaGeneraciones: 2 });

    await falso.doc(`suscripciones/p1/uso/${mesBogota()}`).set({ iaGeneraciones: 60 });
    expect(await codigoDe(asegurarIaDisponible('p1', 'col', d))).toBe('limite_ia');
    // El mes pasado no cuenta.
    await falso.doc(`suscripciones/p1/uso/${mesBogota()}`).delete();
    await falso.doc('suscripciones/p1/uso/2000-01').set({ iaGeneraciones: 999 });
    expect(await codigoDe(asegurarIaDisponible('p1', 'col', d))).toBeNull();
  });
});
