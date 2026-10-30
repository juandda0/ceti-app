import { armarPublicacion } from './biblioteca';
import { UMBRAL_REPORTES, conReporte, fichaPublica, filtrarBiblioteca, normalizar } from './bibliotecaPublica';
import { puede, planMinimoPara } from './planes';

const pub = armarPublicacion({
  entrada: { worldId: 'cw_a', activo: true, nombre: 'Crédito sin sustos', descripcion: 'Tasas y cuotas', competencia: 'credito', ambitosMen: ['manejoDeudas'] },
  piezas: [{ id: 'banco_cw_a_multiple_choice', data: { worldId: 'cw_a', items: [{}, {}] } }],
  overrides: { mc: true },
  grado: '10',
  cursoId: 'k1',
  autorUid: 'p1',
  autorNombre: 'Jorge',
  ahora: 100,
});

describe('biblioteca pública', () => {
  it('la ficha no lleva las piezas, conserva usos y reportes y sabe el grupo de grados', () => {
    const f = fichaPublica(pub, { institucion: '  Colegio Horizonte ', colegioId: 'c1', previa: { usos: 7, reportes: ['x'] } });
    expect(f).not.toHaveProperty('piezas');
    expect(f.usos).toBe(7);
    expect(f.reportes).toEqual(['x']);
    expect(f.oculto).toBe(false);
    expect(f.grupoGrados).toBe('10-11');
    expect(f.institucion).toBe('Colegio Horizonte');
    expect(f.buscable).toBe('credito sin sustos tasas y cuotas');
    expect(fichaPublica(pub, { institucion: null, colegioId: 'c1' }).usos).toBe(0);
  });

  it('un reporte por profe, el autor no cuenta y con 3 se oculta', () => {
    let f = { reportes: [] as string[], autorUid: 'p1' };
    expect(conReporte(f, 'p1')).toBeNull();
    for (let i = 0; i < UMBRAL_REPORTES; i++) {
      const r = conReporte(f, `q${i}`);
      expect(r).not.toBeNull();
      f = { ...f, reportes: r!.reportes };
      expect(r!.oculto).toBe(i === UMBRAL_REPORTES - 1);
    }
    expect(conReporte(f, 'q0')).toBeNull();
  });

  it('filtra por texto sin tildes, grupo y ámbito; los más usados primero; nunca las ocultas', () => {
    const a = fichaPublica(pub, { institucion: null, colegioId: 'c', previa: { usos: 2 } });
    const b = { ...a, titulo: 'Ahorro', buscable: normalizar('La alcancía del barrio'), grupoGrados: '6-7' as const, ambitosMen: ['ahorroInversion'], usos: 9 };
    const c = { ...a, oculto: true, usos: 99 };
    expect(filtrarBiblioteca([a, b, c], {}).map((x) => x.usos)).toEqual([9, 2]);
    expect(filtrarBiblioteca([a, b], { texto: 'ALCANCIA' })).toEqual([b]);
    expect(filtrarBiblioteca([a, b], { grupo: '10-11' })).toEqual([a]);
    expect(filtrarBiblioteca([a, b], { ambito: 'manejoDeudas' })).toEqual([a]);
  });

  it('publica Comandante o Nave; Piloto no', () => {
    expect(puede('nave', 'bibliotecaPublicar')).toBe(true);
    expect(puede('piloto', 'bibliotecaPublicar')).toBe(false);
    expect(planMinimoPara('bibliotecaPublicar')).toBe('comandante');
  });
});
