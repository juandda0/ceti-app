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
import { claimsTrasMudanza, leerEntidad } from './entidades';
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
      [`${C}/cursos/k1/agregados/resumen`]: { porCompetencia: { ahorro: { masteryPromedio: 0.7, estudiantes: 6 } } },
      [`${C}/cursos/k1/comunicados/c1`]: { tipo: 'anuncio', texto: 'secreto', creadoAt: AHORA - DIA },
      [`${C}/cursos/k1/comunicados/c0`]: { tipo: 'anuncio', creadoAt: AHORA - 9 * DIA },
    };
    for (let i = 0; i < 6; i++) {
      d[`${C}/cursos/k1/estudiantes/e${i}`] = { nombre: `Estudiante ${i}`, estado: i === 5 ? 'retirado' : 'activo' };
      d[`estudiantes/e${i}/progress/world_1`] = { uid: `e${i}`, colegioId: 'ent', cursoId: 'k1', updatedAt: AHORA - (i < 3 ? 1 : 40) * DIA };
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
    const texto = JSON.stringify(panel);
    expect(texto).not.toMatch(/secreto|mama@x\.co|Estudiante \d/);
  });
});
