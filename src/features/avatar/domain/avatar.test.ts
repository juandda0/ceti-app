import { hexToLab, mapaDeFamilia, recolorearSvg } from './color';
import { componerAvatar } from './componer';
import { AVATAR_POR_DEFECTO, PERSONAJES, arteDe, leerAvatar, type PrendaId } from './catalogo';
import { estaDisponible, itemsCumplidos, avanceDe } from './desbloqueos';

const SVG =
  '<svg viewBox="0 0 520 790"><ellipse id="sombra-piso" cx="1" cy="1" rx="1" ry="1"/>' +
  '<g id="cuerpo"><path fill="#C39580"/><path fill="#191817"/></g>' +
  '<g id="cabeza"><path fill="#EEAD8F"/><g id="ojo-izq"><path fill="#C39580"/></g><path fill="#342626"/></g></svg>';

describe('color', () => {
  test('el tono base va exactamente al destino', () => {
    const mapa = mapaDeFamilia('#F4B596', ['#C46F5B'], '#653B26');
    expect(mapa['#F4B596']).toBe('#653B26');
  });

  test('el borde sigue más oscuro que la base en piel oscura', () => {
    const mapa = mapaDeFamilia('#F4B596', ['#C46F5B'], '#653B26');
    expect(hexToLab(mapa['#C46F5B']).L).toBeLessThan(hexToLab('#653B26').L);
  });

  test('recolorear ignora mayúsculas, cambia fill y stroke y deja lo demás', () => {
    expect(
      recolorearSvg('<p fill="#aabbcc"/><p stroke="#AABBCC"/><p fill="#000000"/>', {
        '#AABBCC': '#111111',
      })
    ).toBe('<p fill="#111111"/><p stroke="#111111"/><p fill="#000000"/>');
  });
});

describe('componerAvatar', () => {
  const santiago = PERSONAJES.find((p) => p.id === 'santiago')!.prendas.traje;

  test('los tonos solo-cabeza no cambian en la ropa', () => {
    const out = componerAvatar(SVG, santiago, {
      tono: 'oscura',
      pelo: 'original',
      accesorio: null,
    });
    const cuerpo = out.slice(out.indexOf('<g id="cuerpo"'), out.indexOf('<g id="cabeza"'));
    const cabeza = out.slice(out.indexOf('<g id="cabeza"'));
    expect(cuerpo).toContain('#C39580');
    expect(cabeza).not.toContain('#C39580');
    expect(cabeza).toContain('#653B26');
  });

  test('original no toca colores y el accesorio va al final', () => {
    const out = componerAvatar(SVG, santiago, {
      tono: 'original',
      pelo: 'original',
      accesorio: 'gorra',
    });
    expect(out).toContain('#EEAD8F');
    expect(out).toMatch(/<g id="accesorio-gorra"[^>]*>.*<\/g><\/svg>$/);
  });

  test('el pelo se recolorea', () => {
    const out = componerAvatar(SVG, santiago, { tono: 'original', pelo: 'azul', accesorio: null });
    expect(out).not.toContain('#342626');
    expect(out).toContain('#3F6FD6');
  });

  test('el retrato quita la sombra del piso', () => {
    const out = componerAvatar(SVG, santiago, AVATAR_POR_DEFECTO, 'retrato');
    expect(out).not.toContain('sombra-piso');
  });
});

describe('catalogo', () => {
  test('los cuatro tripulantes tienen traje y sudadera', () => {
    expect(PERSONAJES.map((p) => p.id)).toEqual(['juan', 'santiago', 'sofi', 'vale']);
    for (const p of PERSONAJES)
      expect(arteDe({ personaje: p.id, prenda: 'sudadera' }).prenda).toBe('sudadera');
  });

  test('una prenda sin dibujo cae al traje', () => {
    expect(arteDe({ personaje: 'juan', prenda: 'capa' as PrendaId }).prenda).toBe('traje');
  });

  test('leerAvatar descarta valores desconocidos', () => {
    expect(
      leerAvatar({ personaje: 'sofi', tono: 'verde', pelo: 'rubio', accesorio: 'capa' })
    ).toEqual({
      personaje: 'sofi',
      tono: 'original',
      pelo: 'rubio',
      prenda: 'traje',
      accesorio: null,
    });
    expect(leerAvatar({ personaje: 'nadie' })).toBeNull();
    expect(leerAvatar('juan')).toBeNull();
  });
});

describe('desbloqueos', () => {
  const nada = { rachaQuiz: 0, diasAprendiendo: 0, metasCumplidas: 0 };

  test('sin progreso no se gana nada', () => {
    expect(itemsCumplidos(nada)).toEqual([]);
  });

  test('cada requisito desbloquea su ítem', () => {
    expect(itemsCumplidos({ rachaQuiz: 3, diasAprendiendo: 3, metasCumplidas: 0 })).toEqual([
      'gorra',
    ]);
    expect(itemsCumplidos({ rachaQuiz: 7, diasAprendiendo: 9, metasCumplidas: 1 }).sort()).toEqual([
      'audifonos',
      'estrellas',
      'gorra',
      'sudadera',
    ]);
  });

  test('lo libre siempre está disponible y lo demás solo si se ganó', () => {
    expect(estaDisponible('gafas-sol', [])).toBe(true);
    expect(estaDisponible('gorra', [])).toBe(false);
    expect(estaDisponible('gorra', ['gorra'])).toBe(true);
  });

  test('el avance se topa en la meta', () => {
    expect(avanceDe({ tipo: 'racha', dias: 7 }, { ...nada, rachaQuiz: 9 })).toEqual({
      actual: 7,
      meta: 7,
    });
    expect(avanceDe({ tipo: 'meta-cumplida' }, nada)).toBeNull();
  });
});
