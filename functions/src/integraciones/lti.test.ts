jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler?: unknown) => handler ?? _options,
  onRequest: (_options: unknown, handler?: unknown) => handler ?? _options,
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
jest.mock('firebase-admin/firestore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incremento } = require('../educadores/firestoreFalso.test');
  return {
    getFirestore: () => {
      throw new Error('usa la base falsa');
    },
    FieldValue: { increment: incremento, serverTimestamp: () => 'ts' },
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  };
});

// eslint-disable-next-line import/first
import { generateKeyPairSync, sign } from 'node:crypto';
// eslint-disable-next-line import/first
import type { Firestore } from 'firebase-admin/firestore';
// eslint-disable-next-line import/first
import { FirestoreFalso, RefFalsa } from '../educadores/firestoreFalso.test';
// eslint-disable-next-line import/first
import { gestionarPlataforma, procesarLanzamiento, procesarLogin, responder, parametrosDe, type DepsLti, type RespuestaLti } from './lti';
// eslint-disable-next-line import/first
import { CLAIM_CUSTOM, CLAIM_DEPLOYMENT, CLAIM_MESSAGE_TYPE, CLAIM_ROLES, CLAIM_VERSION, VIDA_ESTADO_MS } from './dominio/lti';
// eslint-disable-next-line import/first
import { plataformaIdDe, type Jwk, type Jwks } from './dominio/ltiCripto';

/** El falso con delete/update en transacciones y tx.get de consultas. */
class Db extends FirestoreFalso {
  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const tx = {
      get: (r: { get: () => Promise<unknown> }) => r.get(),
      set: (r: RefFalsa, d: Record<string, unknown>, o?: { merge?: boolean }) => r.escribir(d, !!o?.merge),
      update: (r: RefFalsa, d: Record<string, unknown>) => r.escribir(d, true),
      delete: (r: RefFalsa) => this.docs.delete(r.path),
    };
    return fn(tx);
  }
}

const AHORA = 1_800_000_000_000;
const ISS = 'https://cintia.unicordoba.edu.co';
const CLIENT = 'abc123';
const PID = plataformaIdDe(ISS, CLIENT);

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK: Jwk = { ...(publicKey.export({ format: 'jwk' }) as Jwk), kid: 'k1' };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function firmar(payload: Record<string, unknown>, kid = 'k1') {
  const datos = `${b64({ alg: 'RS256', typ: 'JWT', kid })}.${b64(payload)}`;
  return `${datos}.${sign('RSA-SHA256', Buffer.from(datos), privateKey).toString('base64url')}`;
}

const ADMIN = { uid: 'u1', token: { role: 'profesor', colegioId: 'c1' } };

function base(): Db {
  return new Db({
    'colegios/c1': { entidad: { nombre: 'Unicórdoba', tipo: 'universidad' } },
    'colegios/c1/profes/u1': { rol: 'admin' },
    'colegios/c1/profes/u2': { rol: 'profe' },
    'colegios/c2': { entidad: { nombre: 'Otra', tipo: 'colegio' } },
    'colegios/c2/profes/u9': { rol: 'admin' },
    'colegios/c3': {},
    'colegios/c3/profes/u5': { rol: 'admin' },
  });
}

function deps(db: Db, extra: Partial<DepsLti> = {}): DepsLti & { reloj: { t: number } } {
  let n = 0;
  const reloj = { t: AHORA };
  return {
    reloj,
    db: db as unknown as Firestore,
    ahora: () => reloj.t,
    aleatorio: () => `valor_${++n}`.padEnd(24, 'x'),
    jwks: async () => ({ keys: [JWK] }),
    urlFunctions: () => 'https://us-central1-ceti.cloudfunctions.net',
    urlWeb: () => 'https://ceti-d3769.web.app',
    permitirLocal: false,
    ...extra,
  };
}

const REGISTRO = {
  accion: 'registrar',
  nombre: 'CINTIA',
  issuer: ISS,
  clientId: CLIENT,
  deploymentId: '1',
  authLoginUrl: `${ISS}/mod/lti/auth.php`,
  keysetUrl: `${ISS}/mod/lti/certs.php`,
};

async function codigoDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'sin error';
  } catch (e) {
    const err = e as { code?: string; details?: { codigo?: string } };
    return err.details?.codigo ?? err.code ?? 'otro';
  }
}

describe('gestionarPlataformaLti', () => {
  it('solo un admin de una entidad', async () => {
    const d = deps(base());
    expect(await codigoDe(gestionarPlataforma(d, undefined, { accion: 'listar' }))).toBe('unauthenticated');
    expect(await codigoDe(gestionarPlataforma(d, { uid: 'u1', token: { role: 'estudiante', colegioId: 'c1' } }, { accion: 'listar' }))).toBe(
      'permission-denied'
    );
    expect(await codigoDe(gestionarPlataforma(d, { uid: 'u2', token: { role: 'profesor', colegioId: 'c1' } }, { accion: 'listar' }))).toBe(
      'permission-denied'
    );
    expect(await codigoDe(gestionarPlataforma(d, { uid: 'u5', token: { role: 'profesor', colegioId: 'c3' } }, { accion: 'listar' }))).toBe(
      'failed-precondition'
    );
    expect(await codigoDe(gestionarPlataforma(d, ADMIN, { accion: 'borrarTodo' }))).toBe('invalid-argument');
  });

  it('registra, lista, rechaza duplicados de otra entidad y quita', async () => {
    const db = base();
    const d = deps(db);
    const r = await gestionarPlataforma(d, ADMIN, REGISTRO);
    expect(r.plataformaId).toBe(PID);
    expect(r.herramienta).toEqual({
      urlInicioSesion: 'https://us-central1-ceti.cloudfunctions.net/ltiLogin',
      urlRedireccion: 'https://us-central1-ceti.cloudfunctions.net/ltiLaunch',
      urlLanzamiento: 'https://us-central1-ceti.cloudfunctions.net/ltiLaunch',
      parametroPersonalizado: 'ceti_codigo=XXXXXX',
    });
    expect(r.plataformas).toEqual([
      expect.objectContaining({ plataformaId: PID, nombre: 'CINTIA', deploymentIds: ['1'], lanzamientos: 0 }),
    ]);
    expect(r.plataformas[0]).not.toHaveProperty('creadaPor');
    expect(db.datos(`ltiPlataformas/${PID}`)).toMatchObject({ colegioId: 'c1', creadaPor: 'u1', creadaAt: AHORA });

    // Otro despliegue de la misma plataforma.
    const r2 = await gestionarPlataforma(d, ADMIN, { ...REGISTRO, deploymentId: '2' });
    expect(r2.plataformas).toHaveLength(1);
    expect(r2.plataformas[0].deploymentIds).toEqual(['1', '2']);

    const otraEntidad = { uid: 'u9', token: { role: 'profesor', colegioId: 'c2' } };
    expect(await codigoDe(gestionarPlataforma(d, otraEntidad, REGISTRO))).toBe('plataforma_de_otra_entidad');
    expect(await codigoDe(gestionarPlataforma(d, otraEntidad, { accion: 'quitar', plataformaId: PID }))).toBe(
      'plataforma_no_encontrada'
    );
    expect(await codigoDe(gestionarPlataforma(d, ADMIN, { ...REGISTRO, keysetUrl: 'http://x.co/certs' }))).toBe('url_invalida');

    const q = await gestionarPlataforma(d, ADMIN, { accion: 'quitar', plataformaId: PID });
    expect(q).toMatchObject({ plataformaId: PID, plataformas: [] });
    expect(db.datos(`ltiPlataformas/${PID}`)).toBeUndefined();
  });

  it('máximo 5 plataformas por entidad', async () => {
    const d = deps(base());
    for (let i = 0; i < 5; i++) await gestionarPlataforma(d, ADMIN, { ...REGISTRO, clientId: `c${i}` });
    expect(await codigoDe(gestionarPlataforma(d, ADMIN, { ...REGISTRO, clientId: 'c5' }))).toBe('limite_plataformas');
    expect((await gestionarPlataforma(d, ADMIN, { accion: 'listar' })).plataformas).toHaveLength(5);
  });
});

async function conPlataforma() {
  const db = base();
  const d = deps(db);
  await gestionarPlataforma(d, ADMIN, REGISTRO);
  return { db, d };
}

const LOGIN = {
  iss: ISS,
  login_hint: '2',
  target_link_uri: 'https://us-central1-ceti.cloudfunctions.net/ltiLaunch',
  lti_message_hint: '{"cmid":5}',
  client_id: CLIENT,
  lti_deployment_id: '1',
};

function claims(nonce: string, extra: Record<string, unknown> = {}) {
  return {
    iss: ISS,
    aud: CLIENT,
    sub: 'u-42',
    exp: AHORA / 1000 + 60,
    iat: AHORA / 1000,
    nonce,
    [CLAIM_DEPLOYMENT]: '1',
    [CLAIM_MESSAGE_TYPE]: 'LtiResourceLinkRequest',
    [CLAIM_VERSION]: '1.3.0',
    [CLAIM_ROLES]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    [CLAIM_CUSTOM]: { ceti_codigo: 'abc234' },
    ...extra,
  };
}

function estadoDe(r: RespuestaLti) {
  if (r.tipo !== 'redireccion') throw new Error(`esperaba redirección: ${JSON.stringify(r)}`);
  const u = new URL(r.url);
  return { state: u.searchParams.get('state')!, nonce: u.searchParams.get('nonce')!, url: u };
}

describe('ltiLogin', () => {
  it('guarda el state y redirige a autorizar', async () => {
    const { db, d } = await conPlataforma();
    const { state, nonce, url } = estadoDe(await procesarLogin(d, LOGIN));
    expect(url.origin + url.pathname).toBe(`${ISS}/mod/lti/auth.php`);
    expect(url.searchParams.get('redirect_uri')).toBe('https://us-central1-ceti.cloudfunctions.net/ltiLaunch');
    expect(url.searchParams.get('lti_message_hint')).toBe('{"cmid":5}');
    expect(url.searchParams.get('client_id')).toBe(CLIENT);
    expect(db.datos(`ltiEstados/${state}`)).toEqual({
      nonce,
      plataformaId: PID,
      targetLinkUri: LOGIN.target_link_uri,
      creadoAt: AHORA,
      expiraAt: { ms: AHORA + VIDA_ESTADO_MS },
    });
  });

  it('sin client_id usa la única plataforma de ese issuer', async () => {
    const { db, d } = await conPlataforma();
    const { client_id: _c, ...sinCliente } = LOGIN;
    expect((await procesarLogin(d, sinCliente)).tipo).toBe('redireccion');
    await gestionarPlataforma(d, ADMIN, { ...REGISTRO, clientId: 'segundo' });
    expect(await procesarLogin(d, sinCliente)).toEqual({ tipo: 'error', error: 'plataforma_desconocida' });
    expect(db.docs.size).toBeGreaterThan(0);
  });

  it('errores: faltan datos, plataforma o despliegue desconocidos', async () => {
    const { d } = await conPlataforma();
    expect(await procesarLogin(d, { iss: ISS })).toEqual({ tipo: 'error', error: 'parametros_faltantes' });
    expect(await procesarLogin(d, { ...LOGIN, iss: 'https://otro.edu.co' })).toEqual({ tipo: 'error', error: 'plataforma_desconocida' });
    expect(await procesarLogin(d, { ...LOGIN, lti_deployment_id: '9' })).toEqual({ tipo: 'error', error: 'despliegue_desconocido' });
  });
});

describe('ltiLaunch', () => {
  it('estudiante con código → /join/CODIGO; el state no se reusa', async () => {
    const { db, d } = await conPlataforma();
    const { state, nonce } = estadoDe(await procesarLogin(d, LOGIN));
    d.reloj.t = AHORA + 5000;
    const id_token = firmar(claims(nonce));
    const r = await procesarLanzamiento(d, { id_token, state });
    expect(r).toMatchObject({ tipo: 'abrir', destino: 'https://ceti-d3769.web.app/join/ABC234', lanzamiento: { rol: 'Learner' } });
    expect(db.datos(`ltiEstados/${state}`)).toBeUndefined();
    expect(db.datos(`ltiPlataformas/${PID}`)).toMatchObject({ lanzamientos: 1, ultimoLanzamientoAt: AHORA + 5000 });
    expect(await procesarLanzamiento(d, { id_token, state })).toEqual({ tipo: 'error', error: 'estado_invalido' });
  });

  it('profe → portada', async () => {
    const { d } = await conPlataforma();
    const { state, nonce } = estadoDe(await procesarLogin(d, LOGIN));
    const id_token = firmar(claims(nonce, { [CLAIM_ROLES]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'] }));
    expect(await procesarLanzamiento(d, { id_token, state })).toMatchObject({ tipo: 'abrir', destino: 'https://ceti-d3769.web.app/' });
  });

  it('state vencido, nonce de otro state y parámetros faltantes', async () => {
    const { d } = await conPlataforma();
    const a = estadoDe(await procesarLogin(d, LOGIN));
    const b = estadoDe(await procesarLogin(d, LOGIN));
    expect(await procesarLanzamiento(d, { state: a.state })).toEqual({ tipo: 'error', error: 'parametros_faltantes' });
    expect(await procesarLanzamiento(d, { id_token: 'x', state: '../ltiPlataformas' })).toEqual({ tipo: 'error', error: 'estado_invalido' });
    expect(await procesarLanzamiento(d, { id_token: firmar(claims(b.nonce)), state: a.state })).toEqual({
      tipo: 'error',
      error: 'nonce_invalido',
    });
    d.reloj.t = AHORA + VIDA_ESTADO_MS + 1;
    expect(await procesarLanzamiento(d, { id_token: firmar(claims(b.nonce)), state: b.state })).toEqual({
      tipo: 'error',
      error: 'estado_invalido',
    });
  });

  it('firma inválida, token malformado y JWKS caído', async () => {
    const { d } = await conPlataforma();
    const otra = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const s1 = estadoDe(await procesarLogin(d, LOGIN));
    const datos = `${b64({ alg: 'RS256', kid: 'k1' })}.${b64(claims(s1.nonce))}`;
    const falso = `${datos}.${sign('RSA-SHA256', Buffer.from(datos), otra.privateKey).toString('base64url')}`;
    expect(await procesarLanzamiento(d, { id_token: falso, state: s1.state })).toEqual({ tipo: 'error', error: 'firma_invalida' });
    const s2 = estadoDe(await procesarLogin(d, LOGIN));
    expect(await procesarLanzamiento(d, { id_token: 'no.es.jwt', state: s2.state })).toEqual({ tipo: 'error', error: 'token_malformado' });
    const s3 = estadoDe(await procesarLogin(d, LOGIN));
    const caido = { ...d, jwks: async () => Promise.reject(new Error('timeout')) };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await procesarLanzamiento(caido, { id_token: firmar(claims(s3.nonce)), state: s3.state })).toEqual({
      tipo: 'error',
      error: 'jwks_no_disponible',
    });
    warn.mockRestore();
  });

  it('kid nuevo: vuelve a bajar el JWKS sin caché una vez', async () => {
    const { d } = await conPlataforma();
    const llamadas: boolean[] = [];
    const rotado = {
      ...d,
      jwks: async (_url: string, forzar: boolean): Promise<Jwks> => {
        llamadas.push(forzar);
        return forzar ? { keys: [JWK] } : { keys: [{ ...JWK, kid: 'viejo' }] };
      },
    };
    const s = estadoDe(await procesarLogin(d, LOGIN));
    expect((await procesarLanzamiento(rotado, { id_token: firmar(claims(s.nonce)), state: s.state })).tipo).toBe('abrir');
    expect(llamadas).toEqual([false, true]);
  });
});

describe('adaptador HTTP', () => {
  function resFalsa() {
    const r = { estado: 0, cabeceras: {} as Record<string, string>, cuerpo: '', redirigido: '' };
    const res = {
      status: (n: number) => ((r.estado = n), res),
      set: (k: string, v: string) => ((r.cabeceras[k] = v), res),
      send: (c: string) => (r.cuerpo = c),
      redirect: (n: number, url: string) => ((r.estado = n), (r.redirigido = url)),
    };
    return { r, res };
  }

  it('302, página de apertura y página de error 400', () => {
    const a = resFalsa();
    responder(a.res, { tipo: 'redireccion', url: 'https://lms/auth?x=1' });
    expect(a.r).toMatchObject({ estado: 302, redirigido: 'https://lms/auth?x=1' });
    expect(a.r.cabeceras['Cache-Control']).toBe('no-store');

    const b = resFalsa();
    responder(b.res, { tipo: 'abrir', destino: 'https://ceti-d3769.web.app/join/ABC234', lanzamiento: {} as never });
    expect(b.r.estado).toBe(200);
    expect(b.r.cuerpo).toContain('href="https://ceti-d3769.web.app/join/ABC234" target="_top"');

    const c = resFalsa();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    responder(c.res, { tipo: 'error', error: 'estado_invalido' });
    warn.mockRestore();
    expect(c.r.estado).toBe(400);
    expect(c.r.cabeceras['Content-Type']).toContain('text/html');
    expect(c.r.cuerpo).toContain('El enlace venció o ya se usó');
  });

  it('parametrosDe junta query y formulario, solo strings', () => {
    expect(parametrosDe({ query: { iss: 'a', x: ['1', '2'] }, body: { state: 's', n: 3 } })).toEqual({ iss: 'a', state: 's' });
    expect(parametrosDe({ body: 'texto' })).toEqual({});
  });
});
