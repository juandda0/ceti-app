import { armarAlAzar, grupoDe, grupoNuevo, moverA, sinEstudiante, sinGrupo, validarGrupos } from './grupos';
import { adaptacionesDesdeDoc, adaptacionesEfectivas, erradaAEsconder, vozDeClase, vozPorDefecto } from './adaptaciones';

const U = Array.from({ length: 10 }, (_, i) => `e${i}`);

describe('grupos', () => {
  it('reparte parejo y repetible', () => {
    const g = armarAlAzar(U, 3, 'k1');
    expect(g.map((x) => x.uids.length)).toEqual([4, 3, 3]);
    expect(g.map((x) => x.nombre)).toEqual(['Cóndores', 'Jaguares', 'Colibríes']);
    expect(armarAlAzar(U, 3, 'k1')).toEqual(g);
    expect(new Set(g.flatMap((x) => x.uids)).size).toBe(10);
    expect(armarAlAzar(U, 99, 's')).toHaveLength(12);
  });

  it('mover, sacar y ver quién no tiene grupo', () => {
    const g = armarAlAzar(U, 2, 's');
    const quien = g[0].uids[0];
    const m = moverA(g, quien, g[1].id);
    expect(grupoDe(quien, m)?.id).toBe(g[1].id);
    const s = sinEstudiante(m, quien);
    expect(grupoDe(quien, s)).toBeNull();
    expect(sinGrupo([...U, 'nuevo'], s)).toEqual([quien, 'nuevo']);
  });

  it('valida nombres y que nadie esté en dos grupos', () => {
    const a = grupoNuevo([], 'a');
    const b = grupoNuevo([a], 'b');
    expect(b.nombre).toBe('Jaguares');
    expect(validarGrupos([a, b])).toEqual({ ok: true });
    expect(validarGrupos([a, { ...b, nombre: ' cóndores ' }])).toEqual({ ok: false, error: 'nombre_repetido' });
    expect(validarGrupos([{ ...a, nombre: '  ' }])).toEqual({ ok: false, error: 'nombre_vacio' });
    expect(validarGrupos([{ ...a, uids: ['x'] }, { ...b, uids: ['x'] }])).toEqual({ ok: false, error: 'en_dos_grupos' });
  });
});

describe('adaptaciones', () => {
  it('lee el documento con lo que no está apagado', () => {
    expect(adaptacionesDesdeDoc({ masTiempo: true, letraGrande: 'sí' })).toEqual({
      masTiempo: true,
      menosOpciones: false,
      leerEnVozAlta: false,
      letraGrande: false,
    });
  });

  it('la voz viene encendida en 1° a 3° salvo que el profe la apague', () => {
    expect(vozPorDefecto('2')).toBe(true);
    expect(vozPorDefecto('4')).toBe(false);
    expect(vozDeClase(null, '1')).toBe(true);
    expect(vozDeClase({ leerEnVozAlta: false }, '1')).toBe(false);
    expect(vozDeClase({ leerEnVozAlta: true }, '10')).toBe(true);
    expect(adaptacionesEfectivas(null, true).leerEnVozAlta).toBe(true);
    expect(adaptacionesEfectivas(adaptacionesDesdeDoc({ leerEnVozAlta: true }), false).leerEnVozAlta).toBe(true);
  });

  it('esconde siempre la misma errada, nunca la correcta, solo con 4 o más', () => {
    for (const id of ['a', 'b', 'c', 'dd', 'pregunta-larga']) {
      const i = erradaAEsconder(id, 4, 2);
      expect(i).not.toBe(2);
      expect(i).toBe(erradaAEsconder(id, 4, 2));
    }
    expect(erradaAEsconder('x', 3, 0)).toBeNull();
    expect(erradaAEsconder('x', 4, 7)).toBeNull();
  });
});
