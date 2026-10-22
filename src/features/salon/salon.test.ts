import {
  AJUSTES_POR_DEFECTO,
  escalaParaCaja,
  escribirAjustes,
  leerAjustes,
  limitarCantidad,
  origenDispositivo,
  repartirTelefonos,
  tamanoMarco,
  TELEFONO,
  urlEstudiante,
  urlProfe,
} from './salon';

const local = { protocolo: 'http:', puerto: '8081' };

describe('cantidad de estudiantes', () => {
  it('limita a 4..24 y redondea', () => {
    expect(limitarCantidad(2)).toBe(4);
    expect(limitarCantidad('30')).toBe(24);
    expect(limitarCantidad('12')).toBe(12);
    expect(limitarCantidad(7.6)).toBe(8);
  });

  it('vuelve al valor por defecto con basura', () => {
    expect(limitarCantidad('abc')).toBe(8);
    expect(limitarCantidad(undefined)).toBe(8);
  });
});

describe('ajustes en la URL', () => {
  it('sin query usa los valores por defecto', () => {
    expect(leerAjustes('')).toEqual(AJUSTES_POR_DEFECTO);
    expect(escribirAjustes(AJUSTES_POR_DEFECTO)).toBe('');
  });

  it('lee todos los parámetros', () => {
    expect(
      leerAjustes(
        '?n=12&disposicion=arriba&profe=bitacora&presentacion=1&hosts=loopback&refresco=0'
      )
    ).toEqual({
      n: 12,
      disposicion: 'arriba',
      profe: 'bitacora',
      presentacion: true,
      hosts: 'loopback',
      refresco: false,
    });
  });

  it('ignora valores desconocidos y limita n', () => {
    const a = leerAjustes('n=99&disposicion=circulo&profe=x&hosts=ipv6&refresco=quizas');
    expect(a).toEqual({ ...AJUSTES_POR_DEFECTO, n: 24 });
  });

  it('ida y vuelta', () => {
    const a = {
      n: 16,
      disposicion: 'estudiantes' as const,
      profe: 'inicio' as const,
      presentacion: true,
      hosts: 'loopback' as const,
      refresco: false,
    };
    const q = escribirAjustes(a);
    expect(q).toBe(
      '?n=16&disposicion=estudiantes&profe=inicio&presentacion=1&hosts=loopback&refresco=0'
    );
    expect(leerAjustes(q)).toEqual(a);
  });
});

describe('orígenes por dispositivo', () => {
  it('subdominios de localhost con el puerto de la página', () => {
    expect(origenDispositivo({ tipo: 'profe' }, 'subdominios', local)).toBe(
      'http://profe.localhost:8081'
    );
    expect(origenDispositivo({ tipo: 'estudiante', n: 3 }, 'subdominios', local)).toBe(
      'http://e3.localhost:8081'
    );
  });

  it('loopback para Safari', () => {
    expect(origenDispositivo({ tipo: 'profe' }, 'loopback', local)).toBe('http://127.0.0.2:8081');
    expect(origenDispositivo({ tipo: 'estudiante', n: 1 }, 'loopback', local)).toBe(
      'http://127.0.0.11:8081'
    );
    expect(origenDispositivo({ tipo: 'estudiante', n: 24 }, 'loopback', local)).toBe(
      'http://127.0.0.34:8081'
    );
  });

  it('respeta protocolo y puerto vacío', () => {
    expect(
      origenDispositivo({ tipo: 'estudiante', n: 2 }, 'subdominios', {
        protocolo: 'https',
        puerto: '',
      })
    ).toBe('https://e2.localhost');
  });
});

describe('URLs de entrada', () => {
  it('profe con la pantalla elegida codificada en ir', () => {
    expect(urlProfe('tablero', 'subdominios', local)).toBe(
      'http://profe.localhost:8081/dev/entrar?cuenta=profe-piloto&ir=%2Fcurso%2F10b%3Fnombre%3D10%25C2%25B0B'
    );
    expect(urlProfe('bitacora', 'loopback', local)).toBe(
      'http://127.0.0.2:8081/dev/entrar?cuenta=profe-piloto&ir=%2Fbitacora'
    );
    expect(urlProfe('inicio', 'subdominios', local)).toBe(
      'http://profe.localhost:8081/dev/entrar?cuenta=profe-piloto&ir=%2F'
    );
  });

  it('ir decodifica a la ruta original', () => {
    const url = new URL(urlProfe('tablero', 'subdominios', local));
    expect(url.searchParams.get('ir')).toBe('/curso/10b?nombre=10%C2%B0B');
  });

  it('estudiante n', () => {
    expect(urlEstudiante(5, 'subdominios', local)).toBe(
      'http://e5.localhost:8081/dev/entrar?cuenta=est-5'
    );
  });
});

describe('reparto de teléfonos', () => {
  const marco = tamanoMarco(TELEFONO);

  it('en una caja ancha y baja prefiere una fila', () => {
    const r = repartirTelefonos(4, { ancho: 2000, alto: 500 }, { separacion: 0, etiqueta: 0 });
    expect(r.columnas).toBe(4);
    expect(r.filas).toBe(1);
    expect(r.escala).toBeCloseTo(500 / marco.alto);
  });

  it('en una caja alta y angosta apila', () => {
    const r = repartirTelefonos(4, { ancho: 450, alto: 4000 }, { separacion: 0, etiqueta: 0 });
    expect(r.columnas).toBe(1);
    expect(r.filas).toBe(4);
  });

  it('24 teléfonos caben sin desbordar la caja', () => {
    const caja = { ancho: 1000, alto: 800 };
    const sep = 12;
    const etq = 20;
    const r = repartirTelefonos(24, caja, { separacion: sep, etiqueta: etq });
    expect(r.columnas * r.filas).toBeGreaterThanOrEqual(24);
    const ancho = r.columnas * marco.ancho * r.escala + sep * (r.columnas - 1);
    const alto = r.filas * (marco.alto * r.escala + etq) + sep * (r.filas - 1);
    expect(ancho).toBeLessThanOrEqual(caja.ancho + 1e-6);
    expect(alto).toBeLessThanOrEqual(caja.alto + 1e-6);
  });

  it('caja vacía da escala 0', () => {
    expect(repartirTelefonos(8, { ancho: 0, alto: 0 }).escala).toBe(0);
    expect(escalaParaCaja({ ancho: 0, alto: 10 }, { ancho: 1, alto: 1 })).toBe(0);
  });
});
