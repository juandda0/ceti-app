/**
 * Integración LTI 1.3 (Moodle, Canvas…): lanzamiento mínimo de un enlace a
 * Ceti dentro de un curso de la institución. Puro: sin Firebase y sin
 * `node:crypto`, para que el cliente pueda importar los tipos y los mensajes
 * (la firma JWT y el id de plataforma viven en ./ltiCripto.ts, solo servidor).
 *
 * Flujo (OIDC de terceros, Resource Link Launch):
 * 1. El LMS llama a `ltiLogin` (iss, login_hint, target_link_uri…). Ceti busca
 *    la plataforma registrada, guarda un `state` y un `nonce` de un solo uso y
 *    responde 302 a la URL de autorización del LMS (`construirUrlAutorizacion`).
 * 2. El LMS publica (form_post) un `id_token` firmado RS256 en `ltiLaunch`.
 *    Ceti verifica la firma con el JWKS del LMS y los claims (`validarClaims`)
 *    y manda al estudiante a `/join/<código>` o al profe a la portada
 *    (`urlDestino`). No se crean cuentas ni tokens de Firebase: la persona
 *    entra a Ceti con su propia cuenta y el código une al estudiante.
 *
 * Datos (solo servidor; las reglas niegan por defecto):
 * - `ltiPlataformas/{plataformaId}` (`PlataformaLti`), con
 *   plataformaId = sha256(issuer|clientId) en hex, 32 caracteres.
 * - `ltiEstados/{state}` (`EstadoLti`): vive 10 minutos y se borra al usarlo.
 *
 * Pendiente (fuera de esta versión):
 * - AGS (Assignment and Grade Services): devolver el avance o la nota al
 *   libro de calificaciones del LMS. Pide llaves propias de Ceti (JWKS de la
 *   herramienta) y el token de servicio OAuth2 client_credentials.
 * - Deep Linking: que el profe elija la clase o el mundo desde el LMS en vez de
 *   escribir `ceti_codigo` a mano.
 * - Vincular la cuenta del LMS (`sub`) con la de Ceti para entrar sin volver a
 *   iniciar sesión (y unir sin pasar por el código).
 * - NRPS (lista del curso) y validar `state` contra una cookie del navegador
 *   (hoy el state es de un solo uso en el servidor; como no se abre sesión,
 *   un lanzamiento falsificado solo lleva a una página pública).
 */

const CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/';
export const CLAIM_DEPLOYMENT = `${CLAIM}deployment_id`;
export const CLAIM_MESSAGE_TYPE = `${CLAIM}message_type`;
export const CLAIM_VERSION = `${CLAIM}version`;
export const CLAIM_ROLES = `${CLAIM}roles`;
export const CLAIM_CONTEXT = `${CLAIM}context`;
export const CLAIM_CUSTOM = `${CLAIM}custom`;

/** Vida del `state` entre ltiLogin y ltiLaunch. */
export const VIDA_ESTADO_MS = 10 * 60 * 1000;
/** Desfase de relojes que se tolera en exp/iat. */
export const TOLERANCIA_RELOJ_S = 60;
export const MAX_PLATAFORMAS_POR_ENTIDAD = 5;
export const MAX_DESPLIEGUES = 10;
/** El parámetro personalizado que lleva el código de la clase. */
export const PARAMETRO_CODIGO = 'ceti_codigo';

export const COL_PLATAFORMAS_LTI = 'ltiPlataformas';
export const COL_ESTADOS_LTI = 'ltiEstados';

// ---------------------------------------------------------------------------
// Tipos (también para la UI del admin)
// ---------------------------------------------------------------------------

/** `ltiPlataformas/{plataformaId}`. */
export interface PlataformaLti {
  colegioId: string;
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  authLoginUrl: string;
  keysetUrl: string;
  nombre: string;
  creadaPor: string;
  creadaAt: number;
  lanzamientos: number;
  ultimoLanzamientoAt: number | null;
}

/** `ltiEstados/{state}`. */
export interface EstadoLti {
  nonce: string;
  plataformaId: string;
  targetLinkUri: string;
  creadoAt: number;
}

/** Lo que el admin copia de Moodle/Canvas al registrar la plataforma. */
export interface RegistroPlataformaLti {
  nombre: string;
  /** Moodle: "ID de la plataforma" (la URL del sitio). Canvas: https://canvas.instructure.com. */
  issuer: string;
  clientId: string;
  deploymentId: string;
  /** Moodle: "URL de solicitud de autenticación". */
  authLoginUrl: string;
  /** Moodle: "URL del conjunto de claves públicas". */
  keysetUrl: string;
}

/** Plataforma tal como la ve el admin (nada es secreto en LTI 1.3, pero no va quién la creó). */
export interface PlataformaLtiVista {
  plataformaId: string;
  nombre: string;
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  authLoginUrl: string;
  keysetUrl: string;
  creadaAt: number;
  lanzamientos: number;
  ultimoLanzamientoAt: number | null;
}

/** Lo que el admin pega en Moodle/Canvas al configurar la herramienta. */
export interface DatosHerramientaLti {
  /** Moodle: "URL de inicio de sesión". Canvas: "OpenID Connect Initiation Url". */
  urlInicioSesion: string;
  /** Moodle: "URI(s) de redirección". Canvas: "Redirect URIs". */
  urlRedireccion: string;
  /** Moodle: "URL de la herramienta". Canvas: "Target Link URI". */
  urlLanzamiento: string;
  /** Plantilla del parámetro personalizado de cada enlace: `ceti_codigo=XXXXXX`. */
  parametroPersonalizado: string;
}

export type EntradaGestionarPlataformaLti =
  | ({ accion: 'registrar' } & RegistroPlataformaLti)
  | { accion: 'quitar'; plataformaId: string }
  | { accion: 'listar' };

export type AccionPlataformaLti = EntradaGestionarPlataformaLti['accion'];

export interface SalidaGestionarPlataformaLti {
  ok: true;
  /** Las de la entidad, después de la acción. */
  plataformas: PlataformaLtiVista[];
  herramienta: DatosHerramientaLti;
  /** La registrada o quitada; null en `listar`. */
  plataformaId: string | null;
}

export type RolLti = 'Instructor' | 'Learner';

export interface LanzamientoLti {
  rol: RolLti;
  /** Id de la persona en el LMS (no se guarda). */
  sub: string | null;
  nombre: string | null;
  email: string | null;
  contexto: { id: string; titulo: string | null } | null;
  /** `ceti_codigo` normalizado, o null si no vino o no es válido. */
  codigoClase: string | null;
  deploymentId: string;
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export type ErrorLti =
  // Registro (callable del admin).
  | 'nombre_invalido'
  | 'issuer_invalido'
  | 'client_id_invalido'
  | 'deployment_invalido'
  | 'url_invalida'
  | 'limite_plataformas'
  | 'limite_despliegues'
  | 'plataforma_de_otra_entidad'
  | 'plataforma_no_encontrada'
  // Lanzamiento (ltiLogin / ltiLaunch).
  | 'parametros_faltantes'
  | 'plataforma_desconocida'
  | 'estado_invalido'
  | 'token_malformado'
  | 'jwks_no_disponible'
  | 'algoritmo_no_soportado'
  | 'llave_desconocida'
  | 'firma_invalida'
  | 'emisor_invalido'
  | 'audiencia_invalida'
  | 'token_vencido'
  | 'token_futuro'
  | 'nonce_invalido'
  | 'despliegue_desconocido'
  | 'mensaje_no_soportado'
  | 'version_invalida'
  | 'error_interno';

export const MENSAJES_ERROR_LTI: Record<ErrorLti, string> = {
  nombre_invalido: 'El nombre debe tener entre 2 y 80 caracteres.',
  issuer_invalido: 'Revisa el ID de la plataforma (issuer).',
  client_id_invalido: 'Revisa el ID de cliente.',
  deployment_invalido: 'Revisa el ID de despliegue.',
  url_invalida: 'Las URL deben empezar por https://.',
  limite_plataformas: `La entidad ya tiene ${MAX_PLATAFORMAS_POR_ENTIDAD} plataformas. Quita una para registrar otra.`,
  limite_despliegues: `Esa plataforma ya tiene ${MAX_DESPLIEGUES} despliegues.`,
  plataforma_de_otra_entidad: 'Esa plataforma ya está registrada en otra entidad de Ceti.',
  plataforma_no_encontrada: 'Esa plataforma no está registrada en tu entidad.',
  parametros_faltantes: 'Faltan datos del lanzamiento. Vuelve a abrir el enlace desde tu curso.',
  plataforma_desconocida: 'Tu plataforma no está conectada con Ceti. Avísale al administrador de tu institución.',
  estado_invalido: 'El enlace venció o ya se usó. Vuelve a abrirlo desde tu curso.',
  token_malformado: 'No pudimos leer el lanzamiento. Vuelve a abrir el enlace desde tu curso.',
  jwks_no_disponible: 'No pudimos comprobar el lanzamiento con tu plataforma. Inténtalo de nuevo en un momento.',
  algoritmo_no_soportado: 'No pudimos comprobar el lanzamiento. Avísale al administrador de tu institución.',
  llave_desconocida: 'No pudimos comprobar el lanzamiento. Avísale al administrador de tu institución.',
  firma_invalida: 'No pudimos comprobar el lanzamiento. Avísale al administrador de tu institución.',
  emisor_invalido: 'El lanzamiento no viene de la plataforma registrada.',
  audiencia_invalida: 'El lanzamiento no es para esta conexión de Ceti.',
  token_vencido: 'El lanzamiento venció. Vuelve a abrir el enlace desde tu curso.',
  token_futuro: 'La hora del lanzamiento no cuadra. Vuelve a abrir el enlace desde tu curso.',
  nonce_invalido: 'El enlace venció o ya se usó. Vuelve a abrirlo desde tu curso.',
  despliegue_desconocido: 'Este despliegue de la herramienta no está registrado en Ceti. Avísale al administrador.',
  mensaje_no_soportado: 'Ceti solo abre enlaces de recurso por ahora.',
  version_invalida: 'Ceti solo acepta LTI 1.3.',
  error_interno: 'Algo salió mal al abrir Ceti. Inténtalo de nuevo en un momento.',
};

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: ErrorLti };

// ---------------------------------------------------------------------------
// Registro de la plataforma
// ---------------------------------------------------------------------------

const CONTROL = /[\u0000-\u001f\u007f]/;

function texto(v: unknown, min: number, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= min && t.length <= max && !CONTROL.test(t) ? t : null;
}

/**
 * ¿Es una URL válida para el registro? https siempre; http solo para
 * localhost / 127.0.0.1 y solo si `permitirLocal` (emulador). Sin usuario ni
 * clave en la URL. Sin `URL` del navegador: también corre en React Native.
 */
export function urlValida(v: unknown, permitirLocal: boolean): boolean {
  if (typeof v !== 'string' || v.length > 500 || CONTROL.test(v) || /\s/.test(v)) return false;
  const m = /^(https?):\/\/([^/?#]+)([/?#].*)?$/i.exec(v);
  if (!m) return false;
  const esquema = m[1].toLowerCase();
  const autoridad = m[2];
  if (autoridad.includes('@')) return false;
  const host = autoridad.replace(/:\d{1,5}$/, '').toLowerCase();
  if (!host || !/^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)$/.test(host)) return false;
  if (esquema === 'https') return true;
  return permitirLocal && (host === 'localhost' || host === '127.0.0.1');
}

/** Valida y limpia lo que manda el admin. */
export function validarRegistro(datos: unknown, permitirLocal: boolean): Resultado<RegistroPlataformaLti> {
  const d = (datos ?? {}) as Record<string, unknown>;
  const nombre = texto(d.nombre, 2, 80);
  if (!nombre) return { ok: false, error: 'nombre_invalido' };
  const issuer = texto(d.issuer, 1, 300);
  if (!issuer) return { ok: false, error: 'issuer_invalido' };
  const clientId = texto(d.clientId, 1, 200);
  if (!clientId) return { ok: false, error: 'client_id_invalido' };
  const deploymentId = texto(d.deploymentId, 1, 200);
  if (!deploymentId) return { ok: false, error: 'deployment_invalido' };
  const authLoginUrl = typeof d.authLoginUrl === 'string' ? d.authLoginUrl.trim() : '';
  const keysetUrl = typeof d.keysetUrl === 'string' ? d.keysetUrl.trim() : '';
  if (!urlValida(authLoginUrl, permitirLocal) || !urlValida(keysetUrl, permitirLocal)) {
    return { ok: false, error: 'url_invalida' };
  }
  return { ok: true, valor: { nombre, issuer, clientId, deploymentId, authLoginUrl, keysetUrl } };
}

/**
 * La plataforma tras registrar: nueva, o la misma de la entidad con los datos
 * nuevos y el despliegue sumado (un LMS puede tener varios despliegues).
 */
export function plataformaTrasRegistro(
  previa: PlataformaLti | null,
  r: RegistroPlataformaLti,
  extra: { colegioId: string; uid: string; ahora: number; enLaEntidad: number }
): Resultado<PlataformaLti> {
  if (previa && previa.colegioId !== extra.colegioId) return { ok: false, error: 'plataforma_de_otra_entidad' };
  if (!previa && extra.enLaEntidad >= MAX_PLATAFORMAS_POR_ENTIDAD) return { ok: false, error: 'limite_plataformas' };
  const deploymentIds = previa ? [...previa.deploymentIds] : [];
  if (!deploymentIds.includes(r.deploymentId)) {
    if (deploymentIds.length >= MAX_DESPLIEGUES) return { ok: false, error: 'limite_despliegues' };
    deploymentIds.push(r.deploymentId);
  }
  return {
    ok: true,
    valor: {
      colegioId: extra.colegioId,
      issuer: r.issuer,
      clientId: r.clientId,
      deploymentIds,
      authLoginUrl: r.authLoginUrl,
      keysetUrl: r.keysetUrl,
      nombre: r.nombre,
      creadaPor: previa?.creadaPor ?? extra.uid,
      creadaAt: previa?.creadaAt ?? extra.ahora,
      lanzamientos: previa?.lanzamientos ?? 0,
      ultimoLanzamientoAt: previa?.ultimoLanzamientoAt ?? null,
    },
  };
}

export function vistaPlataforma(plataformaId: string, p: PlataformaLti): PlataformaLtiVista {
  return {
    plataformaId,
    nombre: p.nombre,
    issuer: p.issuer,
    clientId: p.clientId,
    deploymentIds: p.deploymentIds ?? [],
    authLoginUrl: p.authLoginUrl,
    keysetUrl: p.keysetUrl,
    creadaAt: p.creadaAt,
    lanzamientos: p.lanzamientos ?? 0,
    ultimoLanzamientoAt: p.ultimoLanzamientoAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/**
 * Base de las functions HTTP: la configurada (CETI_FUNCTIONS_URL), la del
 * emulador o la de producción en us-central1 (la región por defecto; ninguna
 * function de Ceti fija otra).
 */
export function urlBaseFunctions(e: { configurada?: string | null; proyecto: string; emulador: boolean }): string {
  const c = e.configurada?.trim();
  if (c) return c.replace(/\/+$/, '');
  return e.emulador
    ? `http://127.0.0.1:5001/${e.proyecto}/us-central1`
    : `https://us-central1-${e.proyecto}.cloudfunctions.net`;
}

export function datosHerramienta(baseFunctions: string): DatosHerramientaLti {
  const base = baseFunctions.replace(/\/+$/, '');
  return {
    urlInicioSesion: `${base}/ltiLogin`,
    urlRedireccion: `${base}/ltiLaunch`,
    urlLanzamiento: `${base}/ltiLaunch`,
    parametroPersonalizado: `${PARAMETRO_CODIGO}=XXXXXX`,
  };
}

function conParametros(base: string, params: [string, string][]): string {
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const [sinFragmento] = base.split('#');
  return `${sinFragmento}${sinFragmento.includes('?') ? '&' : '?'}${query}`;
}

/** URL de autorización OIDC del LMS (paso 1 → 2). */
export function construirUrlAutorizacion(p: {
  authLoginUrl: string;
  clientId: string;
  redirectUri: string;
  loginHint: string;
  ltiMessageHint: string | null;
  state: string;
  nonce: string;
}): string {
  const params: [string, string][] = [
    ['scope', 'openid'],
    ['response_type', 'id_token'],
    ['response_mode', 'form_post'],
    ['prompt', 'none'],
    ['client_id', p.clientId],
    ['redirect_uri', p.redirectUri],
    ['login_hint', p.loginHint],
  ];
  if (p.ltiMessageHint) params.push(['lti_message_hint', p.ltiMessageHint]);
  params.push(['state', p.state], ['nonce', p.nonce]);
  return conParametros(p.authLoginUrl, params);
}

/** A dónde va la persona tras el lanzamiento. */
export function urlDestino(l: Pick<LanzamientoLti, 'rol' | 'codigoClase'>, webBase: string): string {
  const base = webBase.replace(/\/+$/, '');
  return l.rol === 'Learner' && l.codigoClase ? `${base}/join/${l.codigoClase}` : `${base}/`;
}

// ---------------------------------------------------------------------------
// Parámetros de los endpoints
// ---------------------------------------------------------------------------

function cadena(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

export interface ParametrosLogin {
  iss: string;
  loginHint: string;
  targetLinkUri: string;
  ltiMessageHint: string | null;
  clientId: string | null;
  deploymentId: string | null;
}

/** Lee los parámetros de ltiLogin (query o formulario). */
export function leerParametrosLogin(entrada: Record<string, unknown>): Resultado<ParametrosLogin> {
  const iss = cadena(entrada.iss, 300);
  const loginHint = cadena(entrada.login_hint, 2000);
  const targetLinkUri = cadena(entrada.target_link_uri, 2000);
  if (!iss || !loginHint || !targetLinkUri) return { ok: false, error: 'parametros_faltantes' };
  return {
    ok: true,
    valor: {
      iss,
      loginHint,
      targetLinkUri,
      ltiMessageHint: cadena(entrada.lti_message_hint, 4000),
      clientId: cadena(entrada.client_id, 200),
      deploymentId: cadena(entrada.lti_deployment_id, 200),
    },
  };
}

/** `state` como lo genera ltiLogin (base64url); sirve también de id del doc. */
export function estadoConFormato(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(v);
}

// ---------------------------------------------------------------------------
// Claims del id_token (ya verificado)
// ---------------------------------------------------------------------------

/**
 * Instructor si algún rol es de profe o administrador (también los sub-roles
 * `membership/Instructor#…`, como TeachingAssistant); si no, Learner.
 */
export function rolDe(roles: unknown): RolLti {
  if (!Array.isArray(roles)) return 'Learner';
  const profe = roles.some(
    (r) =>
      typeof r === 'string' &&
      (r === 'Instructor' ||
        r.endsWith('#Instructor') ||
        r.endsWith('#Administrator') ||
        r.includes('membership#Instructor') ||
        r.includes('/membership/Instructor#'))
  );
  return profe ? 'Instructor' : 'Learner';
}

/** `ceti_codigo` del claim custom: 6 caracteres [A-Z0-9] (sin espacios ni guiones). */
export function codigoDeCustom(custom: unknown): string | null {
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return null;
  const entrada = Object.entries(custom as Record<string, unknown>).find(([k]) => k.toLowerCase() === PARAMETRO_CODIGO);
  if (!entrada || typeof entrada[1] !== 'string') return null;
  const c = entrada[1].toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textoCorto = (v: unknown, max = 200): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/**
 * Valida los claims de un id_token cuya firma ya se verificó, en este orden:
 * iss, aud/azp, exp, iat, nonce, deployment, message_type y version. `ahora`
 * en ms; exp/iat en segundos. El iat no puede estar en el futuro (más que la
 * tolerancia) ni ser más viejo que la vida del state: el LMS firma el token
 * justo después del ltiLogin.
 */
export function validarClaims(
  payload: Record<string, unknown>,
  plataforma: Pick<PlataformaLti, 'issuer' | 'clientId' | 'deploymentIds'>,
  nonceEsperado: string,
  ahora: number
): { ok: true; lanzamiento: LanzamientoLti } | { ok: false; error: ErrorLti } {
  const falla = (error: ErrorLti) => ({ ok: false as const, error });
  if (payload.iss !== plataforma.issuer) return falla('emisor_invalido');

  const aud = payload.aud;
  if (typeof aud === 'string') {
    if (aud !== plataforma.clientId) return falla('audiencia_invalida');
  } else if (Array.isArray(aud)) {
    if (!aud.includes(plataforma.clientId)) return falla('audiencia_invalida');
    if (aud.length > 1 && payload.azp !== plataforma.clientId) return falla('audiencia_invalida');
  } else {
    return falla('audiencia_invalida');
  }
  if (payload.azp !== undefined && payload.azp !== plataforma.clientId) return falla('audiencia_invalida');

  const ahoraS = ahora / 1000;
  const exp = numero(payload.exp);
  if (exp === null || exp + TOLERANCIA_RELOJ_S <= ahoraS) return falla('token_vencido');
  const iat = numero(payload.iat);
  if (iat === null || iat > ahoraS + TOLERANCIA_RELOJ_S) return falla('token_futuro');
  if (iat < ahoraS - VIDA_ESTADO_MS / 1000 - TOLERANCIA_RELOJ_S) return falla('token_vencido');

  if (typeof payload.nonce !== 'string' || payload.nonce !== nonceEsperado) return falla('nonce_invalido');

  const deploymentId = payload[CLAIM_DEPLOYMENT];
  if (typeof deploymentId !== 'string' || !plataforma.deploymentIds.includes(deploymentId)) {
    return falla('despliegue_desconocido');
  }
  if (payload[CLAIM_MESSAGE_TYPE] !== 'LtiResourceLinkRequest') return falla('mensaje_no_soportado');
  if (payload[CLAIM_VERSION] !== '1.3.0') return falla('version_invalida');

  const nombreCompleto = [textoCorto(payload.given_name), textoCorto(payload.family_name)].filter(Boolean).join(' ');
  const ctx = payload[CLAIM_CONTEXT] as Record<string, unknown> | undefined;
  const ctxId = ctx && typeof ctx === 'object' ? textoCorto(ctx.id, 300) : null;
  return {
    ok: true,
    lanzamiento: {
      rol: rolDe(payload[CLAIM_ROLES]),
      sub: textoCorto(payload.sub, 300),
      nombre: textoCorto(payload.name) ?? (nombreCompleto || null),
      email: textoCorto(payload.email, 254),
      contexto: ctxId ? { id: ctxId, titulo: textoCorto(ctx?.title) } : null,
      codigoClase: codigoDeCustom(payload[CLAIM_CUSTOM]),
      deploymentId,
    },
  };
}

// ---------------------------------------------------------------------------
// Páginas HTML
// ---------------------------------------------------------------------------

export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Un string como literal de JS dentro de <script> (sin cerrar la etiqueta). */
function literalJs(s: string): string {
  return JSON.stringify(s)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const ESTILO =
  'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0b1026;color:#f4f6ff}' +
  'main{max-width:28rem;padding:2rem;text-align:center}p{font-size:1.1rem;line-height:1.5}' +
  '.boton{display:inline-block;margin-top:1rem;padding:.8rem 1.6rem;border-radius:999px;' +
  'background:#ffd23f;color:#0b1026;font-weight:700;text-decoration:none}';

function pagina(titulo: string, cuerpo: string, cabeza = '', script = ''): string {
  return (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${escaparHtml(titulo)}</title>${cabeza}<style>${ESTILO}</style></head>` +
    `<body><main>${cuerpo}</main>${script}</body></html>`
  );
}

/**
 * Página que abre Ceti. Moodle puede abrir la herramienta en un iframe: el
 * script lleva la pestaña completa (`window.top`); si el navegador lo bloquea
 * (sin gesto del usuario), queda el botón con target _top. El meta refresh va
 * solo en <noscript> para no cargar Ceti dentro del iframe, donde el inicio de
 * sesión no funciona bien.
 */
export function paginaRedireccion(destino: string): string {
  const url = escaparHtml(destino);
  return pagina(
    'Abriendo Ceti…',
    `<p>Abriendo Ceti…</p><a class="boton" href="${url}" target="_top">Abrir Ceti</a>`,
    `<noscript><meta http-equiv="refresh" content="0;url=${url}"></noscript>`,
    `<script>(function(){var u=${literalJs(destino)};try{if(window.top!==window.self){window.top.location.href=u}else{window.location.replace(u)}}catch(e){}})();</script>`
  );
}

/** Página de error para quien abrió el enlace (sin datos internos). */
export function paginaError(error: ErrorLti): string {
  return pagina('Ceti', `<p>${escaparHtml(MENSAJES_ERROR_LTI[error])}</p>`);
}
