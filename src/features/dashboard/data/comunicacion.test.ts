import {
  agregarToken,
  mensajesDeClase,
  profeDeLaClase,
  resumenDestinatarios,
  sinLeer,
  type Aviso,
  type Comunicado,
  type MensajeBuzon,
} from '@features/dashboard/data/comunicacion';

const anuncio = (id: string, creadoAt: number, extra: Partial<Comunicado> = {}): Comunicado => ({
  id,
  tipo: 'anuncio',
  texto: `anuncio ${id}`,
  contexto: null,
  profeNombre: null,
  creadoAt,
  ...extra,
});
const buzon = (id: string, creadoAt: number, extra: Partial<MensajeBuzon> = {}): MensajeBuzon => ({
  id,
  tipo: 'mensaje',
  texto: `mensaje ${id}`,
  contexto: null,
  profeNombre: 'Prof. Pérez',
  creadoAt,
  leidoAt: null,
  ...extra,
});

describe('mensajes de la clase', () => {
  test('junta anuncios y buzón del más nuevo al más viejo', () => {
    const m = mensajesDeClase(
      [anuncio('a1', 10), anuncio('raro', 5, { tipo: 'mensaje' })],
      [buzon('b1', 20), buzon('b2', 1, { tipo: 'retro', contexto: { worldId: 'w', nombre: 'Luna' } })]
    );
    expect(m.map((x) => [x.id, x.paraMi])).toEqual([
      ['b1', true],
      ['a1', false],
      ['b2', true],
    ]);
    expect(m[2].contexto).toEqual({ worldId: 'w', nombre: 'Luna' });
  });

  test('el nombre del profe sale del mensaje más reciente que lo tenga', () => {
    expect(profeDeLaClase([{ profeNombre: null }, { profeNombre: ' Prof. Pérez ' }])).toBe('Prof. Pérez');
    expect(profeDeLaClase([{ profeNombre: '' }])).toBeNull();
  });

  test('resumen de destinatarios con primeros nombres', () => {
    expect(resumenDestinatarios(['Ana Ruiz'])).toBe('Ana');
    expect(resumenDestinatarios(['Ana Ruiz', 'Beto Gil'])).toBe('Ana y Beto');
    expect(resumenDestinatarios(['Ana Ruiz', 'Beto Gil', 'Caro Paz', 'Dani'])).toBe('Ana, Beto y 2 más');
  });
});

describe('avisos', () => {
  const aviso = (id: string, cursoId: string, leidaAt: number | null): Aviso => ({
    id,
    tipo: 'anuncio',
    titulo: '',
    cuerpo: '',
    ruta: '/',
    colegioId: 'c',
    cursoId,
    datos: null,
    creadoAt: 1,
    leidaAt,
  });

  test('sinLeer filtra por clase', () => {
    const lista = [aviso('1', 'k1', null), aviso('2', 'k2', null), aviso('3', 'k1', 5)];
    expect(sinLeer(lista).map((a) => a.id)).toEqual(['1', '2']);
    expect(sinLeer(lista, 'k1').map((a) => a.id)).toEqual(['1']);
  });

  test('agregarToken deja el nuevo primero, sin repetir, máximo 5', () => {
    expect(agregarToken(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(agregarToken(['1', '2', '3', '4', '5'], 'x')).toEqual(['x', '1', '2', '3', '4']);
  });
});
