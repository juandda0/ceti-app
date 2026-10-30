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
jest.mock('firebase-functions/params', () => ({ defineString: () => ({ value: () => '' }) }));
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
import { claimsTrasMudanza, invitarPorDominio, leerEntidad } from './entidades';
// eslint-disable-next-line import/first
import { calcularPanelDeEntidad } from './entidadPanel';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const AHORA = 1_800_000_000_000;
const DIA = 24 * 60 * 60 * 1000;

describe('mudanza de clases a la entidad', () => {
  it('reescribe la clase en los claims del estudiante (también los de antes)', () => {
    expect(claimsTrasMudanza({ role: 'estudiante', clases: { k1: 'viejo', k2: 'otro' } }, 'k1', 'ent')).toEqual({
      role: 'estudiante',
      clases: { k1: 'ent', k2: 'otro' },
    });
    expect(claimsTrasMudanza({ role: 'estudiante', colegioId: 'viejo', cursoId: 'k1' }, 'k1', 'ent')).toEqual({
      role: 'estudiante',
      clases: { k1: 'ent' },
    });
    expect(claimsTrasMudanza({ role: 'estudiante', clases: { k2: 'otro' } }, 'k1', 'ent')).toBeNull();
    expect(claimsTrasMudanza({ role: 'profesor', colegioId: 'viejo' }, 'k1', 'ent')).toBeNull();
    expect(claimsTrasMudanza(undefined, 'k1', 'ent')).toBeNull();
  });
});

describe('panel de la entidad desde Firestore', () => {
  const C = 'colegios/ent';
  function base(): FirestoreFalso {
    const d: Record<string, Record<string, unknown>> = {
      [C]: { nombre: 'San Mateo', entidad: { nombre: 'San Mateo', tipo: 'colegio' }, licencia: { plan: 'colegio', hasta: AHORA + DIA } },
      [`${C}/profes/ana`]: { nombre: 'Ana', rol: 'admin' },
      [`${C}/profes/beto`]: { nombre: 'Beto', rol: 'profe' },
      [`${C}/cursos/k1`]: { nombre: '10°A', grado: '10', profesorUids: ['beto'] },
      [`${C}/cursos/k1/comunicados/c1`]: { tipo: 'anuncio', texto: 'secreto', creadoAt: AHORA - DIA },
      [`${C}/cursos/k1/comunicados/c0`]: { tipo: 'anuncio', creadoAt: AHORA - 9 * DIA },
    };
    for (let i = 0; i < 6; i++) {
      d[`${C}/cursos/k1/estudiantes/e${i}`] = { nombre: `Estudiante ${i}`, estado: i === 5 ? 'retirado' : 'activo' };
      d[`estudiantes/e${i}/progress/world_3`] = {
        uid: `e${i}`,
        colegioId: 'ent',
        cursoId: 'k1',
        competencia: 'ahorro',
        mastery: i === 5 ? 0 : 0.7,
        updatedAt: AHORA - (i < 3 ? 1 : 40) * DIA,
      };
    }
    d[`${C}/cursos/k1/estudiantes/e0/acudiente/datos`] = { token: 'tok', correo: 'mama@x.co', correoActivo: true };
    return new FirestoreFalso(d);
  }

  it('suma clases, profes y comunicación sin datos nominales', async () => {
    const db = base() as unknown as Firestore;
    const e = await leerEntidad(db, 'ent');
    expect(e.profes.map((p) => p.uid).sort()).toEqual(['ana', 'beto']);
    const panel = await calcularPanelDeEntidad(db, e, AHORA);
    expect(panel.resumen).toMatchObject({ clases: 1, estudiantes: 5, estudiantesActivos: 3, profes: 2 });
    expect(panel.profes.find((p) => p.uid === 'beto')).toMatchObject({ estado: 'activo', clases: 1 });
    expect(panel.profes.find((p) => p.uid === 'ana')?.estado).toBe('sinEmpezar');
    expect(panel.comunicacion).toEqual({ comunicados7d: 1, familiasConResumen: 1, clasesQueEscriben: 1 });
    expect(panel.grupos[0].etiqueta).toBe('10°');
    expect(panel.grupos[0].competencias.ahorro).toBeCloseTo(0.7);
    // Cobertura de las orientaciones del MEN: el mundo de ahorro → "Ahorro e inversión" / Planear.
    expect(panel.cobertura[0]).toMatchObject({ grupoMen: '10-11', cubiertos: 1 });
    expect(panel.cobertura[0].ambitos.ahorroInversion.estudiantes).toBe(5);
    expect(panel.cobertura[0].ambitos.ahorroInversion.dominio).toBeCloseTo(0.7);
    expect(panel.cobertura[0].ambitos.presupuesto).toEqual({ estudiantes: 0, dominio: null });
    expect(panel.cobertura[0].competencias.planear.estudiantes).toBe(5);
    expect(panel.ambitosCubiertos).toEqual(['ahorroInversion']);
    expect(panel.periodo).toBeNull();
    const texto = JSON.stringify(panel);
    expect(texto).not.toMatch(/secreto|mama@x\.co|Estudiante \d/);
  });

  it('con periodo solo cuenta el avance de esas fechas (y oculta grupos chicos)', async () => {
    const db = base() as unknown as Firestore;
    const rango = { desde: AHORA - 10 * DIA, hasta: AHORA };
    const panel = await calcularPanelDeEntidad(db, await leerEntidad(db, 'ent'), AHORA, rango);
    expect(panel.periodo).toEqual(rango);
    // Solo e0..e2 avanzaron en los últimos 10 días: 3 < 5, sin dominio.
    expect(panel.cobertura[0].ambitos.ahorroInversion).toEqual({ estudiantes: 3, dominio: null });
  });
});

describe('invitación por dominio (Fase 9)', () => {
  const base = () =>
    new FirestoreFalso({
      'colegios/sm': { entidad: { nombre: 'San Mateo', tipo: 'colegio', creadaAt: 1, creadaPor: 'diana', dominios: ['sanmateo.edu.co'] }, licencia: { plan: 'colegio', hasta: AHORA + 300 * DIA } },
      'colegios/sm/profes/diana': { nombre: 'Diana', correo: 'diana@sanmateo.edu.co', rol: 'admin' },
      'dominiosEntidad/sanmateo.edu.co': { colegioId: 'sm' },
    });
  const profe = { uid: 'jorge', colegioId: 'personal', correo: 'jorge@sanmateo.edu.co', nombre: 'Jorge' };

  it('crea la invitación una vez, solo con correo verificado', async () => {
    const f = base();
    const db = f as unknown as Firestore;
    expect(await invitarPorDominio(db, profe, false, AHORA)).toBe(false);
    expect(await invitarPorDominio(db, profe, true, AHORA)).toBe(true);
    expect(f.datos('invitacionesProfe/sm:jorge@sanmateo.edu.co')).toMatchObject({ colegioId: 'sm', rol: 'profe', porDominio: true, invitadoPorNombre: 'San Mateo' });
    expect(await invitarPorDominio(db, profe, true, AHORA)).toBe(false);
  });

  it('no a un dominio sin entidad, ni a quien ya es de ella o la rechazó', async () => {
    const f = base();
    const db = f as unknown as Firestore;
    expect(await invitarPorDominio(db, { ...profe, correo: 'jorge@otro.edu.co' }, true, AHORA)).toBe(false);
    expect(await invitarPorDominio(db, { ...profe, colegioId: 'sm' }, true, AHORA)).toBe(false);
    await f.doc('rechazosDominio/sm:jorge@sanmateo.edu.co').set({ rechazadaAt: 1 });
    expect(await invitarPorDominio(db, profe, true, AHORA)).toBe(false);
  });
});
