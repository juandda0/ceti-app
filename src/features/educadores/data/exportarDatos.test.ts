import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import type { BancoDoc } from '@features/learning/data/quiz.types';
import type { MicroteoriaBank } from '@features/learning/data/content.types';
import type { CursoConfigMundos } from '@shared/types/tenancy';
import {
  armarExportacion,
  nombreArchivoExportacion,
  recopilarDatosProfe,
  sinUndefined,
  type EntradaExportacion,
} from './exportarDatos';

// jest.mock se eleva sobre los imports: los repositorios quedan falsos.
jest.mock('@features/dashboard/data/rosterRepository', () => ({
  rosterRepository: { getCursosByProfesor: jest.fn(), getColegioNombre: jest.fn() },
}));
jest.mock('@features/dashboard/data/classConfigRepository', () => ({
  classConfigRepository: { get: jest.fn() },
}));
jest.mock('@features/dashboard/data/courseContentRepository', () => ({
  courseContentRepository: { loadResolvedBanco: jest.fn(), loadResolvedMicroteoria: jest.fn() },
}));
jest.mock('@shared/lib/export/downloadFile', () => ({ downloadTextFile: jest.fn(() => true) }));

const AHORA = Date.parse('2026-10-22T15:00:00.000Z');

const cursoA = {
  id: 'c1',
  nombre: '9A',
  grado: '9',
  profesorUids: ['p1'],
  codigo: 'ABC123',
  createdAt: 1000,
  // Campos que nunca deben salir aunque lleguen en el documento.
  estudiantes: [{ uid: 'e1', email: 'luisa@colegio.edu.co', nombre: 'Luisa Pérez' }],
  progreso: { e1: { mastery: 0.8 } },
} as unknown as CursoWithId;

const cursoB: CursoWithId = {
  id: 'c2',
  nombre: '10B',
  grado: '10',
  profesorUids: ['p1'],
};

const configA = {
  mundos: [
    { worldId: 'presupuesto', activo: true, nombre: undefined },
    {
      worldId: 'cw_ahorro_feria',
      activo: false,
      nombre: 'Feria del ahorro',
      descripcion: 'Un mundo mío',
      competencia: 'ahorro',
    },
  ],
  overrides: { presupuesto: { mc: true, teoria: true }, cw_ahorro_feria: { vf: true } },
  version: 4,
  updatedAt: 2000,
  updatedByUid: 'p1',
  roster: ['luisa@colegio.edu.co'],
} as unknown as CursoConfigMundos;

const banco = (n: string) =>
  ({
    bancoId: n,
    items: [{ id: `${n}-1`, enunciado: 'Pregunta', extra: undefined }],
  }) as unknown as BancoDoc;
const teoria = {
  cards: [{ id: 't1', titulo: 'Idea' }],
  generadoPor: 'p1',
} as unknown as MicroteoriaBank;

function entrada(): EntradaExportacion {
  return {
    ahora: AHORA,
    profe: { uid: 'p1', nombre: 'Marta', correo: 'marta@colegio.edu.co' },
    colegio: { id: 'col1', nombre: 'Colegio Sol' },
    plan: 'piloto',
    clases: [
      {
        curso: cursoA,
        config: configA,
        contenido: {
          presupuesto: { mc: banco('mc'), teoria },
          cw_ahorro_feria: { vf: banco('vf'), ordenar: undefined },
        },
      },
      { curso: cursoB, config: null, contenido: {} },
    ],
  };
}

describe('armarExportacion', () => {
  it('arma el formato con las dos clases, la config y el contenido propio', () => {
    const x = armarExportacion(entrada());
    expect(x.formato).toBe('ceti-profe-v1');
    expect(x.generadoAt).toBe('2026-10-22T15:00:00.000Z');
    expect(x.profe).toEqual({ uid: 'p1', nombre: 'Marta', correo: 'marta@colegio.edu.co' });
    expect(x.colegio).toEqual({ id: 'col1', nombre: 'Colegio Sol' });
    expect(x.plan).toBe('piloto');
    expect(x.clases).toHaveLength(2);

    const [a, b] = x.clases;
    expect(a).toMatchObject({
      id: 'c1',
      nombre: '9A',
      grado: '9',
      codigo: 'ABC123',
      creadaAt: 1000,
    });
    expect(a.config?.version).toBe(4);
    expect(a.config?.overrides).toEqual({
      presupuesto: { mc: true, teoria: true },
      cw_ahorro_feria: { vf: true },
    });
    expect(a.mundosPropios).toEqual([
      {
        worldId: 'cw_ahorro_feria',
        activo: false,
        nombre: 'Feria del ahorro',
        descripcion: 'Un mundo mío',
        competencia: 'ahorro',
      },
    ]);
    expect(Object.keys(a.contenidoPropio).sort()).toEqual(['cw_ahorro_feria', 'presupuesto']);
    expect(a.contenidoPropio.presupuesto.mc?.items).toHaveLength(1);
    expect(a.contenidoPropio.presupuesto.teoria?.cards).toHaveLength(1);
    expect(a.contenidoPropio.cw_ahorro_feria.vf?.items).toHaveLength(1);
    expect('ordenar' in a.contenidoPropio.cw_ahorro_feria).toBe(false);

    expect(b).toEqual({
      id: 'c2',
      nombre: '10B',
      grado: '10',
      codigo: null,
      creadaAt: null,
      config: null,
      mundosPropios: [],
      contenidoPropio: {},
    });
  });

  it('no deja ningún undefined', () => {
    const x = armarExportacion(entrada());
    const buscar = (v: unknown): boolean => {
      if (v === undefined) return true;
      if (Array.isArray(v)) return v.some(buscar);
      if (v && typeof v === 'object') return Object.values(v).some(buscar);
      return false;
    };
    expect(buscar(x)).toBe(false);
    expect('nombre' in (x.clases[0].config?.mundos[0] ?? {})).toBe(false);
    expect(sinUndefined({ a: [1, undefined, { b: undefined, c: 2 }] })).toEqual({
      a: [1, { c: 2 }],
    });
  });

  it('no filtra nada de estudiantes', () => {
    const json = JSON.stringify(armarExportacion(entrada()));
    expect(json).not.toContain('luisa@colegio.edu.co');
    expect(json).not.toContain('Luisa');
    expect(json).not.toContain('estudiantes');
    expect(json).not.toContain('progreso');
    expect(json).not.toContain('roster');
    expect(json).not.toContain('mastery');
    expect(json).not.toContain('profesorUids');
  });
});

describe('nombreArchivoExportacion', () => {
  it('usa la fecha de Bogotá (UTC-5) cerca de la medianoche UTC', () => {
    // 03:00 UTC del 23 = 22:00 del 22 en Bogotá.
    expect(nombreArchivoExportacion(Date.parse('2026-10-23T03:00:00.000Z'))).toBe(
      'ceti-mis-datos-2026-10-22.json'
    );
    // 05:30 UTC del 23 = 00:30 del 23 en Bogotá.
    expect(nombreArchivoExportacion(Date.parse('2026-10-23T05:30:00.000Z'))).toBe(
      'ceti-mis-datos-2026-10-23.json'
    );
  });
});

describe('recopilarDatosProfe', () => {
  it('lee solo las piezas con override y guarda solo las personalizadas', async () => {
    (rosterRepository.getCursosByProfesor as jest.Mock).mockResolvedValue([cursoA, cursoB]);
    (rosterRepository.getColegioNombre as jest.Mock).mockResolvedValue('Colegio Sol');
    (classConfigRepository.get as jest.Mock).mockImplementation(async (_c: string, id: string) =>
      id === 'c1' ? configA : null
    );
    (courseContentRepository.loadResolvedBanco as jest.Mock).mockImplementation(
      async (_c: string, _cu: string, _g: string, worldId: string, piece: string) =>
        // El vf del mundo propio "se perdió": vuelve el default y no se exporta.
        worldId === 'cw_ahorro_feria'
          ? { doc: banco('default'), source: 'default' }
          : { doc: banco(piece), source: 'custom' }
    );
    (courseContentRepository.loadResolvedMicroteoria as jest.Mock).mockResolvedValue({
      doc: teoria,
      source: 'custom',
    });

    const r = await recopilarDatosProfe({
      uid: 'p1',
      colegioId: 'col1',
      nombre: 'Marta',
      correo: null,
      plan: 'cadete',
      ahora: AHORA,
    });

    expect(rosterRepository.getCursosByProfesor).toHaveBeenCalledWith('col1', 'p1', {
      incluirArchivadas: true,
    });
    expect(courseContentRepository.loadResolvedBanco).toHaveBeenCalledTimes(2);
    expect(courseContentRepository.loadResolvedBanco).toHaveBeenCalledWith(
      'col1',
      'c1',
      '9',
      'presupuesto',
      'mc',
      true
    );
    expect(courseContentRepository.loadResolvedMicroteoria).toHaveBeenCalledWith(
      'col1',
      'c1',
      '9',
      'presupuesto',
      true
    );
    expect(r.colegio).toEqual({ id: 'col1', nombre: 'Colegio Sol' });
    expect(r.clases[0].contenido.presupuesto.mc).toBeTruthy();
    expect(r.clases[0].contenido.presupuesto.teoria).toBe(teoria);
    expect(r.clases[0].contenido.cw_ahorro_feria.vf).toBeUndefined();
    expect(r.clases[1].config).toBeNull();
  });
});
