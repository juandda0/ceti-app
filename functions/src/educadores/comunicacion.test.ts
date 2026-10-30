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
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => {
    throw new Error('usa la base falsa');
  },
  FieldValue: { serverTimestamp: () => 'ts' },
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));

// eslint-disable-next-line import/first
import type { Firestore } from 'firebase-admin/firestore';
// eslint-disable-next-line import/first
import {
  TEXTO_COMUNICADO_MAX,
  leerPedidoComunicado,
  limpiarTexto,
  tituloParaEstudiante,
  vistaPrevia,
  type PedidoComunicado,
} from './dominio';
// eslint-disable-next-line import/first
import { enviarComunicadoEnClase, rutaMensajes } from './comunicacion';
// eslint-disable-next-line import/first
import { mensajesExpo, notificar, tokensDe, type PushSaliente } from './notificaciones';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const CURSO = 'colegios/c1/cursos/k1';
const AHORA = 1_800_000_000_000;

function base(): FirestoreFalso {
  return new FirestoreFalso({
    [CURSO]: { nombre: '9°A', profesorUids: ['profe'] },
    [`${CURSO}/estudiantes/ana`]: { nombre: 'Ana Ruiz', estado: 'activo' },
    [`${CURSO}/estudiantes/beto`]: { nombre: 'Beto Gil', estado: 'activo' },
    [`${CURSO}/estudiantes/caro`]: { nombre: 'Caro Paz', estado: 'pendiente_atestacion' },
    [`${CURSO}/estudiantes/dani`]: { nombre: 'Dani Sol', estado: 'retirado' },
    'notificaciones/ana': { expoTokens: ['ExponentPushToken[abc]'] },
  });
}

function enviadorEspia() {
  const enviados: PushSaliente[][] = [];
  return { enviados, enviar: async (m: PushSaliente[]) => void enviados.push(m) };
}

const pedido = (p: Partial<PedidoComunicado>): PedidoComunicado => ({
  tipo: 'anuncio',
  texto: 'Hola clase',
  para: [],
  contexto: null,
  ...p,
});

describe('leerPedidoComunicado', () => {
  test('acepta un anuncio y limpia el texto', () => {
    const r = leerPedidoComunicado({ tipo: 'anuncio', texto: '  Hola   clase \r\n\n\n\n chao ', para: ['x'] });
    expect(r).toEqual({
      ok: true,
      pedido: { tipo: 'anuncio', texto: 'Hola clase\n\nchao', para: [], contexto: null },
    });
  });

  test('un mensaje necesita destinatarios únicos y válidos', () => {
    expect(leerPedidoComunicado({ tipo: 'mensaje', texto: 'hola', para: [] })).toEqual({
      ok: false,
      error: 'sin_destinatarios',
    });
    const r = leerPedidoComunicado({ tipo: 'mensaje', texto: 'hola', para: ['a', 'a', 'b', 'x/y', 3] });
    expect(r.ok && r.pedido.para).toEqual(['a', 'b']);
    const muchos = Array.from({ length: 61 }, (_, i) => `u${i}`);
    expect(leerPedidoComunicado({ tipo: 'mensaje', texto: 'hola', para: muchos })).toEqual({
      ok: false,
      error: 'demasiados_destinatarios',
    });
  });

  test('un comentario va a un solo estudiante y guarda el mundo', () => {
    expect(leerPedidoComunicado({ tipo: 'retro', texto: 'bien', para: ['a', 'b'] })).toEqual({
      ok: false,
      error: 'retro_a_uno',
    });
    const r = leerPedidoComunicado({
      tipo: 'retro',
      texto: 'bien',
      para: ['a'],
      contexto: { worldId: 'world_3', nombre: ' Estrella del Ahorro ', extra: 'no' },
    });
    expect(r.ok && r.pedido.contexto).toEqual({ worldId: 'world_3', nombre: 'Estrella del Ahorro' });
  });

  test('rechaza tipos raros, vacíos y textos largos', () => {
    expect(leerPedidoComunicado({ tipo: 'chat', texto: 'x' })).toEqual({ ok: false, error: 'tipo_invalido' });
    expect(leerPedidoComunicado({ tipo: 'anuncio', texto: '   ' })).toEqual({ ok: false, error: 'texto_vacio' });
    expect(
      leerPedidoComunicado({ tipo: 'anuncio', texto: 'a'.repeat(TEXTO_COMUNICADO_MAX + 1) })
    ).toEqual({ ok: false, error: 'texto_largo' });
  });

  test('textos de la notificación', () => {
    expect(limpiarTexto('a  b')).toBe('a b');
    expect(vistaPrevia('uno\ndos', 120)).toBe('uno dos');
    expect(vistaPrevia('a'.repeat(200), 10)).toHaveLength(10);
    expect(tituloParaEstudiante('anuncio', '9°A', null)).toBe('Anuncio de 9°A');
    expect(tituloParaEstudiante('retro', '9°A', { worldId: 'w', nombre: 'Luna' })).toBe(
      'Tu profe comentó tu avance en Luna'
    );
    expect(tituloParaEstudiante('mensaje', '', null)).toBe('Mensaje de tu profe de tu clase');
  });
});

describe('enviarComunicadoEnClase', () => {
  test('un anuncio llega a los activos, sin buzón, con aviso y push', async () => {
    const db = base();
    const espia = enviadorEspia();
    const r = await enviarComunicadoEnClase(db as unknown as Firestore, 'profe', 'c1', 'k1', pedido({}), {
      plan: 'cadete',
      profeNombre: 'Prof. Pérez',
      enviador: espia,
      ahora: AHORA,
    });
    expect(r).toEqual({ id: expect.any(String), enviados: 2, omitidos: 0 });
    expect(db.datos(`${CURSO}/comunicados/${r.id}`)).toMatchObject({
      tipo: 'anuncio',
      texto: 'Hola clase',
      profeNombre: 'Prof. Pérez',
      destinatarios: 2,
      creadoAt: AHORA,
    });
    expect(db.datos(`${CURSO}/comunicados/${r.id}`)).not.toHaveProperty('para');
    expect(db.datos(`${CURSO}/estudiantes/ana/buzon/${r.id}`)).toBeUndefined();
    const avisos = [...db.docs.keys()].filter((p) => p.startsWith('notificaciones/') && p.includes('/items/'));
    expect(avisos.map((p) => p.split('/')[1]).sort()).toEqual(['ana', 'beto']);
    expect(db.datos(avisos[0])).toMatchObject({
      tipo: 'anuncio',
      titulo: 'Anuncio de 9°A',
      ruta: rutaMensajes('c1', 'k1'),
      datos: { comunicadoId: r.id },
      leidaAt: null,
    });
    expect(espia.enviados).toEqual([
      [{ tokens: ['ExponentPushToken[abc]'], titulo: 'Anuncio de 9°A', cuerpo: 'Hola clase', ruta: rutaMensajes('c1', 'k1') }],
    ]);
  });

  test('un mensaje va al buzón de cada activo pedido y salta a los demás', async () => {
    const db = base();
    const r = await enviarComunicadoEnClase(
      db as unknown as Firestore,
      'profe',
      'c1',
      'k1',
      pedido({ tipo: 'mensaje', texto: 'Te extraño', para: ['ana', 'caro', 'dani', 'zoe'] }),
      { plan: 'piloto', profeNombre: null, enviador: enviadorEspia(), ahora: AHORA }
    );
    expect(r.enviados).toBe(1);
    expect(r.omitidos).toBe(3);
    expect(db.datos(`${CURSO}/comunicados/${r.id}`)).toMatchObject({
      para: ['ana'],
      nombres: ['Ana Ruiz'],
      profeNombre: null,
    });
    expect(db.datos(`${CURSO}/estudiantes/ana/buzon/${r.id}`)).toMatchObject({
      tipo: 'mensaje',
      texto: 'Te extraño',
      comunicadoId: r.id,
      leidoAt: null,
    });
    expect(db.datos(`${CURSO}/estudiantes/caro/buzon/${r.id}`)).toBeUndefined();
  });

  test('mensajes y comentarios piden Piloto; los anuncios no', async () => {
    const db = base();
    await expect(
      enviarComunicadoEnClase(
        db as unknown as Firestore,
        'profe',
        'c1',
        'k1',
        pedido({ tipo: 'retro', para: ['ana'] }),
        { plan: 'cadete', profeNombre: null, enviador: enviadorEspia(), ahora: AHORA }
      )
    ).rejects.toMatchObject({ code: 'failed-precondition', details: { codigo: 'requiere_plan', funcion: 'mensajesProfe' } });
  });

  test('solo el profe de la clase, nadie sin autorización y con tope diario', async () => {
    const db = base();
    const deps = { plan: 'piloto' as const, profeNombre: null, enviador: enviadorEspia(), ahora: AHORA };
    await expect(
      enviarComunicadoEnClase(db as unknown as Firestore, 'otro', 'c1', 'k1', pedido({}), deps)
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      enviarComunicadoEnClase(
        db as unknown as Firestore,
        'profe',
        'c1',
        'k1',
        pedido({ tipo: 'mensaje', para: ['caro'] }),
        deps
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    for (let i = 0; i < 40; i++) {
      db.docs.set(`${CURSO}/comunicados/viejo${i}`, { creadoAt: AHORA - 1000 });
    }
    db.docs.set(`${CURSO}/comunicados/ayer`, { creadoAt: AHORA - 2 * 24 * 3600 * 1000 });
    await expect(
      enviarComunicadoEnClase(db as unknown as Firestore, 'profe', 'c1', 'k1', pedido({}), deps)
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
  });
});

describe('notificaciones', () => {
  test('tokensDe solo deja tokens de Expo, máximo 5', () => {
    expect(
      tokensDe({ expoTokens: ['ExpoPushToken[a]', 'malo', 3, ...Array(6).fill('ExponentPushToken[b]')] })
    ).toHaveLength(5);
    expect(tokensDe({ expoTokens: ['malo'] })).toEqual([]);
    expect(tokensDe(undefined)).toEqual([]);
  });

  test('mensajesExpo arma un mensaje por token en lotes de 100', () => {
    const tokens = Array.from({ length: 150 }, (_, i) => `ExpoPushToken[${i}]`);
    const lotes = mensajesExpo([{ tokens, titulo: 't', cuerpo: 'c', ruta: '/r' }]);
    expect(lotes.map((l) => l.length)).toEqual([100, 50]);
    expect(lotes[0][0]).toEqual({ to: 'ExpoPushToken[0]', title: 't', body: 'c', sound: 'default', data: { ruta: '/r' } });
  });

  test('sin tokens guarda el aviso y no manda push', async () => {
    const db = new FirestoreFalso();
    const espia = enviadorEspia();
    await notificar(
      db as unknown as Firestore,
      ['u1', 'u1'],
      { tipo: 'alerta', titulo: 't', cuerpo: 'c', ruta: '/r', colegioId: 'c1', cursoId: 'k1' },
      espia,
      AHORA
    );
    const items = [...db.docs.keys()].filter((p) => p.startsWith('notificaciones/u1/items/'));
    expect(items).toHaveLength(1);
    expect(db.datos(items[0])).toMatchObject({ datos: null, creadoAt: AHORA, leidaAt: null });
    expect(espia.enviados).toEqual([]);
  });
});
