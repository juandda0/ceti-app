import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import {
  CLAIM_CONTEXT,
  CLAIM_CUSTOM,
  CLAIM_DEPLOYMENT,
  CLAIM_MESSAGE_TYPE,
  CLAIM_ROLES,
  CLAIM_VERSION,
  MAX_PLATAFORMAS_POR_ENTIDAD,
  MENSAJES_ERROR_LTI,
  codigoDeCustom,
  construirUrlAutorizacion,
  datosHerramienta,
  escaparHtml,
  leerParametrosLogin,
  paginaError,
  paginaRedireccion,
  plataformaTrasRegistro,
  rolDe,
  urlBaseFunctions,
  urlDestino,
  urlValida,
  validarClaims,
  validarRegistro,
  type PlataformaLti,
  type RegistroPlataformaLti,
} from './lti';
import { aleatorio, decodificarJwt, plataformaIdDe, verificarFirmaRs256, type Jwk, type Jwks } from './ltiCripto';

const AHORA = 1_800_000_000_000;
const AHORA_S = AHORA / 1000;

function parDeLlaves(kid: string) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...(publicKey.export({ format: 'jwk' }) as Jwk), kid, alg: 'RS256', use: 'sig' };
  return { privateKey, jwk };
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function firmar(payload: Record<string, unknown>, llave: KeyObject, header: Record<string, unknown> = { alg: 'RS256', typ: 'JWT', kid: 'k1' }) {
  const datos = `${b64(header)}.${b64(payload)}`;
  return `${datos}.${sign('RSA-SHA256', Buffer.from(datos), llave).toString('base64url')}`;
}

const A = parDeLlaves('k1');
const B = parDeLlaves('k2');
const JWKS: Jwks = { keys: [A.jwk] };

const PLATAFORMA: Pick<PlataformaLti, 'issuer' | 'clientId' | 'deploymentIds'> = {
  issuer: 'https://cintia.unicordoba.edu.co',
  clientId: 'abc123',
  deploymentIds: ['1'],
};

function claims(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: PLATAFORMA.issuer,
    aud: PLATAFORMA.clientId,
    sub: 'u-42',
    exp: AHORA_S + 60,
    iat: AHORA_S - 5,
    nonce: 'n0nce',
    name: 'Mariana López',
    email: 'mariana@unicordoba.edu.co',
    [CLAIM_DEPLOYMENT]: '1',
    [CLAIM_MESSAGE_TYPE]: 'LtiResourceLinkRequest',
    [CLAIM_VERSION]: '1.3.0',
    [CLAIM_ROLES]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    [CLAIM_CONTEXT]: { id: 'curso-7', title: 'Finanzas I' },
    [CLAIM_CUSTOM]: { ceti_codigo: 'abc234' },
    ...extra,
  };
}

const validar = (extra: Record<string, unknown> = {}, nonce = 'n0nce') => validarClaims(claims(extra), PLATAFORMA, nonce, AHORA);

describe('firma RS256 contra el JWKS', () => {
  it('acepta un token firmado con la llave del kid', () => {
    const jwt = decodificarJwt(firmar(claims(), A.privateKey));
    expect(jwt).not.toBeNull();
    expect(verificarFirmaRs256(jwt!, JWKS)).toEqual({ ok: true });
  });

  it('rechaza un token firmado con otra llave', () => {
    const jwt = decodificarJwt(firmar(claims(), B.privateKey));
    expect(verificarFirmaRs256(jwt!, JWKS)).toEqual({ ok: false, error: 'firma_invalida' });
  });

  it('rechaza un kid que no está en el JWKS', () => {
    const jwt = decodificarJwt(firmar(claims(), B.privateKey, { alg: 'RS256', kid: 'k2' }));
    expect(verificarFirmaRs256(jwt!, JWKS)).toEqual({ ok: false, error: 'llave_desconocida' });
    expect(verificarFirmaRs256(jwt!, { keys: [A.jwk, B.jwk] })).toEqual({ ok: true });
  });

  it('sin kid usa la única llave; con varias, no adivina', () => {
    const jwt = decodificarJwt(firmar(claims(), A.privateKey, { alg: 'RS256' }));
    expect(verificarFirmaRs256(jwt!, JWKS)).toEqual({ ok: true });
    expect(verificarFirmaRs256(jwt!, { keys: [A.jwk, B.jwk] })).toEqual({ ok: false, error: 'llave_desconocida' });
  });

  it('rechaza alg none o HS256 y payload alterado', () => {
    const token = firmar(claims(), A.privateKey);
    const [, p, s] = token.split('.');
    const none = decodificarJwt(`${b64({ alg: 'none', kid: 'k1' })}.${p}.${s}`);
    expect(verificarFirmaRs256(none!, JWKS)).toEqual({ ok: false, error: 'algoritmo_no_soportado' });
    const hs = decodificarJwt(`${b64({ alg: 'HS256', kid: 'k1' })}.${p}.${s}`);
    expect(verificarFirmaRs256(hs!, JWKS)).toEqual({ ok: false, error: 'algoritmo_no_soportado' });
    const alterado = decodificarJwt(`${token.split('.')[0]}.${b64(claims({ sub: 'otro' }))}.${s}`);
    expect(verificarFirmaRs256(alterado!, JWKS)).toEqual({ ok: false, error: 'firma_invalida' });
  });

  it('decodificarJwt rechaza lo que no es un JWT compacto', () => {
    expect(decodificarJwt('abc')).toBeNull();
    expect(decodificarJwt('a.b')).toBeNull();
    expect(decodificarJwt('a.b.c')).toBeNull(); // header/payload no son JSON
    expect(decodificarJwt('e30.e30.$$')).toBeNull();
    expect(decodificarJwt(42)).toBeNull();
    expect(decodificarJwt(`${b64({ alg: 'RS256' })}.${b64(claims())}.x`)?.payload.sub).toBe('u-42');
  });
});

describe('claims del lanzamiento', () => {
  it('un estudiante válido con su código', () => {
    const r = validar();
    expect(r).toEqual({
      ok: true,
      lanzamiento: {
        rol: 'Learner',
        sub: 'u-42',
        nombre: 'Mariana López',
        email: 'mariana@unicordoba.edu.co',
        contexto: { id: 'curso-7', titulo: 'Finanzas I' },
        codigoClase: 'ABC234',
        deploymentId: '1',
      },
    });
  });

  it('iss y aud', () => {
    expect(validar({ iss: 'https://otro.edu.co' })).toEqual({ ok: false, error: 'emisor_invalido' });
    expect(validar({ aud: 'otro' })).toEqual({ ok: false, error: 'audiencia_invalida' });
    expect(validar({ aud: ['otro'] })).toEqual({ ok: false, error: 'audiencia_invalida' });
    expect(validar({ aud: undefined })).toEqual({ ok: false, error: 'audiencia_invalida' });
    expect(validar({ aud: ['abc123'] }).ok).toBe(true);
    // Varias audiencias: azp debe ser Ceti.
    expect(validar({ aud: ['abc123', 'otra'] })).toEqual({ ok: false, error: 'audiencia_invalida' });
    expect(validar({ aud: ['abc123', 'otra'], azp: 'abc123' }).ok).toBe(true);
    expect(validar({ azp: 'otra' })).toEqual({ ok: false, error: 'audiencia_invalida' });
  });

  it('exp vencido e iat en el futuro (con tolerancia de 60 s)', () => {
    expect(validar({ exp: AHORA_S - 61 })).toEqual({ ok: false, error: 'token_vencido' });
    expect(validar({ exp: AHORA_S - 30 }).ok).toBe(true);
    expect(validar({ exp: 'mañana' })).toEqual({ ok: false, error: 'token_vencido' });
    expect(validar({ iat: AHORA_S + 61 })).toEqual({ ok: false, error: 'token_futuro' });
    expect(validar({ iat: AHORA_S + 30 }).ok).toBe(true);
    expect(validar({ iat: AHORA_S - 12 * 60, exp: AHORA_S + 60 })).toEqual({ ok: false, error: 'token_vencido' });
  });

  it('nonce distinto', () => {
    expect(validar({}, 'otro')).toEqual({ ok: false, error: 'nonce_invalido' });
    expect(validar({ nonce: undefined })).toEqual({ ok: false, error: 'nonce_invalido' });
  });

  it('deployment no registrado', () => {
    expect(validar({ [CLAIM_DEPLOYMENT]: '2' })).toEqual({ ok: false, error: 'despliegue_desconocido' });
    expect(validar({ [CLAIM_DEPLOYMENT]: undefined })).toEqual({ ok: false, error: 'despliegue_desconocido' });
  });

  it('message_type y version', () => {
    expect(validar({ [CLAIM_MESSAGE_TYPE]: 'LtiDeepLinkingRequest' })).toEqual({ ok: false, error: 'mensaje_no_soportado' });
    expect(validar({ [CLAIM_VERSION]: '1.1' })).toEqual({ ok: false, error: 'version_invalida' });
  });

  it('rol Instructor o Learner', () => {
    const m = 'http://purl.imsglobal.org/vocab/lis/v2/membership';
    expect(rolDe([`${m}#Instructor`])).toBe('Instructor');
    expect(rolDe([`${m}/Instructor#TeachingAssistant`])).toBe('Instructor');
    expect(rolDe(['http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator'])).toBe('Instructor');
    expect(rolDe(['http://purl.imsglobal.org/vocab/lis/v2/institution/person#Student', `${m}#Learner`])).toBe('Learner');
    expect(rolDe(undefined)).toBe('Learner');
    expect(rolDe('Instructor')).toBe('Learner');
    const r = validar({ [CLAIM_ROLES]: [`${m}#Instructor`] });
    expect(r.ok && r.lanzamiento.rol).toBe('Instructor');
  });

  it('código custom válido e inválido', () => {
    expect(codigoDeCustom({ ceti_codigo: ' mate2b ' })).toBe('MATE2B');
    expect(codigoDeCustom({ CETI_CODIGO: 'ABC-234' })).toBe('ABC234');
    expect(codigoDeCustom({ ceti_codigo: 'ABC23' })).toBeNull();
    expect(codigoDeCustom({ ceti_codigo: 'ABC2345' })).toBeNull();
    expect(codigoDeCustom({ ceti_codigo: 'AB<23>' })).toBeNull();
    expect(codigoDeCustom({ ceti_codigo: 123456 })).toBeNull();
    expect(codigoDeCustom({ otro: 'ABC234' })).toBeNull();
    expect(codigoDeCustom(undefined)).toBeNull();
    const r = validar({ [CLAIM_CUSTOM]: { ceti_codigo: '$(x)' } });
    expect(r.ok && r.lanzamiento.codigoClase).toBeNull();
  });

  it('nombre de given/family, sin email ni contexto', () => {
    const r = validar({ name: undefined, given_name: 'Ana', family_name: 'Ruiz', email: undefined, [CLAIM_CONTEXT]: undefined });
    expect(r.ok && r.lanzamiento).toMatchObject({ nombre: 'Ana Ruiz', email: null, contexto: null });
  });
});

describe('URLs', () => {
  it('autorización con todos los parámetros', () => {
    const url = construirUrlAutorizacion({
      authLoginUrl: 'https://cintia.unicordoba.edu.co/mod/lti/auth.php',
      clientId: 'abc123',
      redirectUri: 'https://us-central1-p.cloudfunctions.net/ltiLaunch',
      loginHint: '2',
      ltiMessageHint: '{"cmid":5}',
      state: 'S',
      nonce: 'N',
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://cintia.unicordoba.edu.co/mod/lti/auth.php');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      scope: 'openid',
      response_type: 'id_token',
      response_mode: 'form_post',
      prompt: 'none',
      client_id: 'abc123',
      redirect_uri: 'https://us-central1-p.cloudfunctions.net/ltiLaunch',
      login_hint: '2',
      lti_message_hint: '{"cmid":5}',
      state: 'S',
      nonce: 'N',
    });
  });

  it('autorización sin lti_message_hint y con query previa', () => {
    const url = construirUrlAutorizacion({
      authLoginUrl: 'https://lms.test/auth?x=1',
      clientId: 'c',
      redirectUri: 'r',
      loginHint: 'h',
      ltiMessageHint: null,
      state: 's',
      nonce: 'n',
    });
    expect(url.startsWith('https://lms.test/auth?x=1&scope=openid&')).toBe(true);
    expect(url).not.toContain('lti_message_hint');
  });

  it('destino según rol y código', () => {
    const web = 'https://ceti-d3769.web.app/';
    expect(urlDestino({ rol: 'Learner', codigoClase: 'ABC234' }, web)).toBe('https://ceti-d3769.web.app/join/ABC234');
    expect(urlDestino({ rol: 'Learner', codigoClase: null }, web)).toBe('https://ceti-d3769.web.app/');
    expect(urlDestino({ rol: 'Instructor', codigoClase: 'ABC234' }, web)).toBe('https://ceti-d3769.web.app/');
  });

  it('base de las functions y datos para el LMS', () => {
    expect(urlBaseFunctions({ configurada: 'https://lti.ceti.co/', proyecto: 'p', emulador: false })).toBe('https://lti.ceti.co');
    expect(urlBaseFunctions({ configurada: '', proyecto: 'ceti-d3769', emulador: false })).toBe(
      'https://us-central1-ceti-d3769.cloudfunctions.net'
    );
    expect(urlBaseFunctions({ proyecto: 'demo-ceti', emulador: true })).toBe('http://127.0.0.1:5001/demo-ceti/us-central1');
    expect(datosHerramienta('https://x.net')).toEqual({
      urlInicioSesion: 'https://x.net/ltiLogin',
      urlRedireccion: 'https://x.net/ltiLaunch',
      urlLanzamiento: 'https://x.net/ltiLaunch',
      parametroPersonalizado: 'ceti_codigo=XXXXXX',
    });
  });
});

describe('registro de la plataforma', () => {
  const datos: RegistroPlataformaLti = {
    nombre: ' CINTIA ',
    issuer: 'https://cintia.unicordoba.edu.co',
    clientId: 'abc123',
    deploymentId: '1',
    authLoginUrl: 'https://cintia.unicordoba.edu.co/mod/lti/auth.php',
    keysetUrl: 'https://cintia.unicordoba.edu.co/mod/lti/certs.php',
  };

  it('valida y limpia', () => {
    expect(validarRegistro(datos, false)).toEqual({ ok: true, valor: { ...datos, nombre: 'CINTIA' } });
    expect(validarRegistro({ ...datos, nombre: 'x' }, false)).toEqual({ ok: false, error: 'nombre_invalido' });
    expect(validarRegistro({ ...datos, issuer: '  ' }, false)).toEqual({ ok: false, error: 'issuer_invalido' });
    expect(validarRegistro({ ...datos, issuer: 'x'.repeat(301) }, false)).toEqual({ ok: false, error: 'issuer_invalido' });
    expect(validarRegistro({ ...datos, clientId: '' }, false)).toEqual({ ok: false, error: 'client_id_invalido' });
    expect(validarRegistro({ ...datos, deploymentId: 7 }, false)).toEqual({ ok: false, error: 'deployment_invalido' });
    expect(validarRegistro({ ...datos, keysetUrl: 'http://cintia.unicordoba.edu.co/certs' }, false)).toEqual({
      ok: false,
      error: 'url_invalida',
    });
    expect(validarRegistro(null, false)).toEqual({ ok: false, error: 'nombre_invalido' });
  });

  it('https siempre; http solo en localhost y con permitirLocal', () => {
    expect(urlValida('https://moodle.edu.co/mod/lti/auth.php', false)).toBe(true);
    expect(urlValida('https://moodle.edu.co:8443', false)).toBe(true);
    expect(urlValida('http://moodle.edu.co/auth', true)).toBe(false);
    expect(urlValida('http://localhost:8080/mod/lti/auth.php', true)).toBe(true);
    expect(urlValida('http://127.0.0.1/certs', true)).toBe(true);
    expect(urlValida('http://localhost:8080/mod/lti/auth.php', false)).toBe(false);
    expect(urlValida('https://usuario:clave@moodle.edu.co', false)).toBe(false);
    expect(urlValida('javascript:alert(1)', true)).toBe(false);
    expect(urlValida('https://moodle .edu.co', false)).toBe(false);
    expect(urlValida('ftp://moodle.edu.co', false)).toBe(false);
  });

  it('nueva, re-registro con otro despliegue, otra entidad y tope', () => {
    const r = validarRegistro(datos, false);
    if (!r.ok) throw new Error('registro');
    const extra = { colegioId: 'c1', uid: 'u1', ahora: AHORA, enLaEntidad: 0 };
    const nueva = plataformaTrasRegistro(null, r.valor, extra);
    expect(nueva).toMatchObject({ ok: true, valor: { colegioId: 'c1', deploymentIds: ['1'], lanzamientos: 0, creadaPor: 'u1' } });
    if (!nueva.ok) return;
    const otra = plataformaTrasRegistro(nueva.valor, { ...r.valor, deploymentId: '2' }, { ...extra, uid: 'u2', ahora: AHORA + 1 });
    expect(otra).toMatchObject({ ok: true, valor: { deploymentIds: ['1', '2'], creadaPor: 'u1', creadaAt: AHORA } });
    expect(plataformaTrasRegistro(nueva.valor, r.valor, { ...extra, colegioId: 'c2' })).toEqual({
      ok: false,
      error: 'plataforma_de_otra_entidad',
    });
    expect(plataformaTrasRegistro(null, r.valor, { ...extra, enLaEntidad: MAX_PLATAFORMAS_POR_ENTIDAD })).toEqual({
      ok: false,
      error: 'limite_plataformas',
    });
    // Re-registrar la misma no cuenta contra el tope.
    expect(plataformaTrasRegistro(nueva.valor, r.valor, { ...extra, enLaEntidad: MAX_PLATAFORMAS_POR_ENTIDAD }).ok).toBe(true);
  });

  it('plataformaId estable de 32 hex', () => {
    const id = plataformaIdDe(datos.issuer, datos.clientId);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(plataformaIdDe(datos.issuer, datos.clientId)).toBe(id);
    expect(plataformaIdDe(datos.issuer, 'otro')).not.toBe(id);
    expect(aleatorio()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('parámetros y páginas', () => {
  it('login exige iss, login_hint y target_link_uri', () => {
    expect(leerParametrosLogin({ iss: 'i', login_hint: 'h' })).toEqual({ ok: false, error: 'parametros_faltantes' });
    expect(leerParametrosLogin({ iss: 'i', login_hint: 'h', target_link_uri: 't', client_id: 'c' })).toEqual({
      ok: true,
      valor: { iss: 'i', loginHint: 'h', targetLinkUri: 't', ltiMessageHint: null, clientId: 'c', deploymentId: null },
    });
  });

  it('la página de redirección escapa y lleva a la pestaña completa', () => {
    const html = paginaRedireccion('https://ceti.app/join/ABC234?a=1&b="2"</script>');
    expect(html).toContain('Abriendo Ceti…');
    expect(html).toContain('target="_top"');
    expect(html).toContain('>Abrir Ceti</a>');
    expect(html).toContain('window.top.location.href');
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('a=1&amp;b=&quot;2&quot;&lt;/script&gt;');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('la página de error solo lleva el mensaje', () => {
    expect(paginaError('estado_invalido')).toContain(escaparHtml(MENSAJES_ERROR_LTI.estado_invalido));
    expect(escaparHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});
