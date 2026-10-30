/**
 * LTI 1.3 mínimo (ver dominio/lti.ts): un enlace a Ceti en un curso de
 * Moodle o Canvas que lleva al estudiante al ingreso de su clase.
 *
 * - `gestionarPlataformaLti` (onCall): un admin de la entidad registra, quita
 *   o lista las plataformas (`ltiPlataformas/{id}`) y recibe las URL que debe
 *   pegar en el LMS.
 * - `ltiLogin` (onRequest): inicio de sesión OIDC de terceros; guarda el
 *   `ltiEstados/{state}` y manda al LMS a autorizar.
 * - `ltiLaunch` (onRequest): recibe el id_token, lo verifica (firma RS256 con el
 *   JWKS del LMS y claims) y abre Ceti en `/join/<código>` o en la portada.
 *
 * Todo con el Admin SDK: las reglas niegan `ltiPlataformas` y `ltiEstados` al
 * cliente por defecto. Para limpiar los states que nunca se usan, conviene una
 * política TTL de Firestore sobre `ltiEstados.expiraAt`.
 */
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { FieldValue, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  COL_ESTADOS_LTI,
  COL_PLATAFORMAS_LTI,
  MENSAJES_ERROR_LTI,
  VIDA_ESTADO_MS,
  construirUrlAutorizacion,
  datosHerramienta,
  estadoConFormato,
  leerParametrosLogin,
  paginaError,
  paginaRedireccion,
  plataformaTrasRegistro,
  urlBaseFunctions,
  urlDestino,
  validarClaims,
  validarRegistro,
  vistaPlataforma,
  type ErrorLti,
  type EstadoLti,
  type LanzamientoLti,
  type PlataformaLti,
  type SalidaGestionarPlataformaLti,
} from './dominio/lti';
import { aleatorio, decodificarJwt, esJwks, plataformaIdDe, verificarFirmaRs256, type Jwks } from './dominio/ltiCripto';
import { URL_APP } from '../educadores/invitaciones';

const URL_APP_POR_DEFECTO = 'https://ceti-d3769.web.app';
/** Base pública de las functions HTTP; vacía = la de us-central1 del proyecto. */
export const CETI_FUNCTIONS_URL = defineString('CETI_FUNCTIONS_URL', { default: '' });

// ---------------------------------------------------------------------------
// Dependencias (inyectables en los tests)
// ---------------------------------------------------------------------------

export interface DepsLti {
  db: Firestore;
  ahora: () => number;
  aleatorio: () => string;
  /** JWKS de la plataforma; `forzar` salta la caché (rotación de llaves). */
  jwks: (url: string, forzar: boolean) => Promise<Jwks>;
  urlFunctions: () => string;
  urlWeb: () => string;
  /** http://localhost en el registro: solo en el emulador. */
  permitirLocal: boolean;
}

const VIDA_CACHE_JWKS_MS = 10 * 60 * 1000;
const TIMEOUT_JWKS_MS = 5000;
const cacheJwks = new Map<string, { jwks: Jwks; hasta: number }>();

/** Descarga el JWKS con caché en memoria de 10 min por URL y timeout de 5 s. */
export async function jwksConCache(url: string, forzar: boolean, ahora = Date.now()): Promise<Jwks> {
  const guardado = cacheJwks.get(url);
  if (!forzar && guardado && guardado.hasta > ahora) return guardado.jwks;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_JWKS_MS), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  const cuerpo: unknown = await res.json();
  if (!esJwks(cuerpo)) throw new Error('JWKS sin keys');
  cacheJwks.set(url, { jwks: cuerpo, hasta: ahora + VIDA_CACHE_JWKS_MS });
  return cuerpo;
}

function emulador(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

function dependenciasReales(): DepsLti {
  return {
    db: getFirestore(),
    ahora: () => Date.now(),
    aleatorio: () => aleatorio(),
    jwks: (url, forzar) => jwksConCache(url, forzar),
    urlFunctions: () =>
      urlBaseFunctions({
        configurada: CETI_FUNCTIONS_URL.value(),
        proyecto: process.env.GCLOUD_PROJECT ?? '',
        emulador: emulador(),
      }),
    urlWeb: () => URL_APP.value() || URL_APP_POR_DEFECTO,
    permitirLocal: emulador(),
  };
}

const refPlataforma = (db: Firestore, id: string) => db.doc(`${COL_PLATAFORMAS_LTI}/${id}`);

// ---------------------------------------------------------------------------
// gestionarPlataformaLti
// ---------------------------------------------------------------------------

type Auth = { uid: string; token: Record<string, unknown> } | undefined;

function errorLti(error: ErrorLti): never {
  throw new HttpsError('failed-precondition', MENSAJES_ERROR_LTI[error], { codigo: error });
}

/** Profe con colegio, admin de una entidad que existe. Devuelve su colegioId. */
async function exigirAdminEntidad(db: Firestore, auth: Auth): Promise<{ uid: string; cid: string }> {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (auth.token.role !== 'profesor') throw new HttpsError('permission-denied', 'Solo para profes.');
  const cid = auth.token.colegioId;
  if (typeof cid !== 'string' || !cid) {
    throw new HttpsError('failed-precondition', 'Tu cuenta no tiene un colegio asignado.');
  }
  const [colegio, profe] = await Promise.all([
    db.doc(`colegios/${cid}`).get(),
    db.doc(`colegios/${cid}/profes/${auth.uid}`).get(),
  ]);
  if (!colegio.get('entidad')) throw new HttpsError('failed-precondition', 'Tu colegio todavía no es una entidad.');
  if (profe.get('rol') !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin de la entidad puede hacer esto.');
  }
  return { uid: auth.uid, cid };
}

async function plataformasDe(db: Firestore, cid: string) {
  const snap = await db.collection(COL_PLATAFORMAS_LTI).where('colegioId', '==', cid).get();
  return snap.docs
    .map((d) => vistaPlataforma(d.id, d.data() as PlataformaLti))
    .sort((a, b) => a.creadaAt - b.creadaAt);
}

export async function gestionarPlataforma(deps: DepsLti, auth: Auth, data: unknown): Promise<SalidaGestionarPlataformaLti> {
  const { db } = deps;
  const { uid, cid } = await exigirAdminEntidad(db, auth);
  const d = (data ?? {}) as Record<string, unknown>;
  let plataformaId: string | null = null;

  if (d.accion === 'registrar') {
    const r = validarRegistro(d, deps.permitirLocal);
    if (!r.ok) errorLti(r.error);
    plataformaId = plataformaIdDe(r.valor.issuer, r.valor.clientId);
    const ref = refPlataforma(db, plataformaId);
    await db.runTransaction(async (tx) => {
      const [previa, deLaEntidad] = await Promise.all([
        tx.get(ref),
        tx.get(db.collection(COL_PLATAFORMAS_LTI).where('colegioId', '==', cid)),
      ]);
      const siguiente = plataformaTrasRegistro(previa.exists ? (previa.data() as PlataformaLti) : null, r.valor, {
        colegioId: cid,
        uid,
        ahora: deps.ahora(),
        enLaEntidad: deLaEntidad.size,
      });
      if (!siguiente.ok) errorLti(siguiente.error);
      tx.set(ref, siguiente.valor);
    });
  } else if (d.accion === 'quitar') {
    const id = d.plataformaId;
    if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) {
      throw new HttpsError('invalid-argument', 'Falta la plataforma.');
    }
    const ref = refPlataforma(db, id);
    const snap = await ref.get();
    if (!snap.exists || snap.get('colegioId') !== cid) errorLti('plataforma_no_encontrada');
    await ref.delete();
    plataformaId = id;
  } else if (d.accion !== 'listar') {
    throw new HttpsError('invalid-argument', "La acción debe ser 'registrar', 'quitar' o 'listar'.");
  }

  return {
    ok: true,
    plataformas: await plataformasDe(db, cid),
    herramienta: datosHerramienta(deps.urlFunctions()),
    plataformaId,
  };
}

export const gestionarPlataformaLti = onCall((request) =>
  gestionarPlataforma(dependenciasReales(), request.auth as Auth, request.data)
);

// ---------------------------------------------------------------------------
// ltiLogin / ltiLaunch
// ---------------------------------------------------------------------------

export type RespuestaLti =
  | { tipo: 'redireccion'; url: string }
  | { tipo: 'abrir'; destino: string; lanzamiento: LanzamientoLti }
  | { tipo: 'error'; error: ErrorLti };

const fallo = (error: ErrorLti): RespuestaLti => ({ tipo: 'error', error });

/** Paso 1: el LMS pide iniciar sesión; Ceti lo manda a autorizar. */
export async function procesarLogin(deps: DepsLti, entrada: Record<string, unknown>): Promise<RespuestaLti> {
  const p = leerParametrosLogin(entrada);
  if (!p.ok) return fallo(p.error);
  const { iss, clientId } = p.valor;
  const { db } = deps;

  let plataformaId: string | null = null;
  let plataforma: PlataformaLti | null = null;
  if (clientId) {
    const id = plataformaIdDe(iss, clientId);
    const snap = await refPlataforma(db, id).get();
    if (snap.exists) [plataformaId, plataforma] = [id, snap.data() as PlataformaLti];
  } else {
    // client_id es opcional en LTI: sirve si hay una sola plataforma con ese issuer.
    const snap = await db.collection(COL_PLATAFORMAS_LTI).where('issuer', '==', iss).limit(2).get();
    if (snap.size === 1) [plataformaId, plataforma] = [snap.docs[0].id, snap.docs[0].data() as PlataformaLti];
  }
  if (!plataformaId || !plataforma || plataforma.issuer !== iss) return fallo('plataforma_desconocida');
  if (p.valor.deploymentId && !plataforma.deploymentIds.includes(p.valor.deploymentId)) {
    return fallo('despliegue_desconocido');
  }

  const state = deps.aleatorio();
  const nonce = deps.aleatorio();
  const ahora = deps.ahora();
  const estado: EstadoLti = { nonce, plataformaId, targetLinkUri: p.valor.targetLinkUri, creadoAt: ahora };
  await db.doc(`${COL_ESTADOS_LTI}/${state}`).set({ ...estado, expiraAt: Timestamp.fromMillis(ahora + VIDA_ESTADO_MS) });

  return {
    tipo: 'redireccion',
    url: construirUrlAutorizacion({
      authLoginUrl: plataforma.authLoginUrl,
      clientId: plataforma.clientId,
      redirectUri: datosHerramienta(deps.urlFunctions()).urlRedireccion,
      loginHint: p.valor.loginHint,
      ltiMessageHint: p.valor.ltiMessageHint,
      state,
      nonce,
    }),
  };
}

/** Lee el state y lo borra en la misma transacción: no se puede reusar. */
async function consumirEstado(db: Firestore, state: string): Promise<EstadoLti | null> {
  const ref = db.doc(`${COL_ESTADOS_LTI}/${state}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data() as EstadoLti;
  });
}

/** Paso 2: el LMS publica el id_token; Ceti lo verifica y abre la app. */
export async function procesarLanzamiento(deps: DepsLti, entrada: Record<string, unknown>): Promise<RespuestaLti> {
  const { db } = deps;
  const idToken = entrada.id_token;
  const state = entrada.state;
  if (typeof idToken !== 'string' || !idToken || typeof state !== 'string' || !state) {
    return fallo('parametros_faltantes');
  }
  if (!estadoConFormato(state)) return fallo('estado_invalido');
  const estado = await consumirEstado(db, state);
  const ahora = deps.ahora();
  if (!estado || typeof estado.creadoAt !== 'number' || ahora - estado.creadoAt > VIDA_ESTADO_MS) {
    return fallo('estado_invalido');
  }

  const jwt = decodificarJwt(idToken);
  if (!jwt) return fallo('token_malformado');

  const ref = refPlataforma(db, estado.plataformaId);
  const snap = await ref.get();
  if (!snap.exists) return fallo('plataforma_desconocida');
  const plataforma = snap.data() as PlataformaLti;

  let firma;
  try {
    firma = verificarFirmaRs256(jwt, await deps.jwks(plataforma.keysetUrl, false));
    // Kid nuevo: el LMS pudo rotar sus llaves; se baja el JWKS sin caché una vez.
    if (!firma.ok && firma.error === 'llave_desconocida') {
      firma = verificarFirmaRs256(jwt, await deps.jwks(plataforma.keysetUrl, true));
    }
  } catch (e) {
    console.warn('ltiLaunch: JWKS no disponible', e instanceof Error ? e.message : String(e));
    return fallo('jwks_no_disponible');
  }
  if (!firma.ok) return fallo(firma.error);

  const v = validarClaims(jwt.payload, plataforma, estado.nonce, ahora);
  if (!v.ok) return fallo(v.error);

  try {
    await ref.update({ lanzamientos: FieldValue.increment(1), ultimoLanzamientoAt: ahora });
  } catch (e) {
    // El contador no frena el lanzamiento.
    console.warn('ltiLaunch: no se pudo contar', e instanceof Error ? e.message : String(e));
  }
  return { tipo: 'abrir', destino: urlDestino(v.lanzamiento, deps.urlWeb()), lanzamiento: v.lanzamiento };
}

// ---------------------------------------------------------------------------
// Adaptadores HTTP
// ---------------------------------------------------------------------------

/** Query y formulario en un solo objeto, solo con valores string. */
export function parametrosDe(req: { query?: unknown; body?: unknown }): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const fuente of [req.query, req.body]) {
    if (!fuente || typeof fuente !== 'object') continue;
    for (const [k, v] of Object.entries(fuente as Record<string, unknown>)) {
      if (typeof v === 'string') salida[k] = v;
    }
  }
  return salida;
}

interface ResHttp {
  status(n: number): ResHttp;
  set(campo: string, valor: string): ResHttp;
  send(cuerpo: string): unknown;
  redirect(status: number, url: string): unknown;
}

const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

export function responder(res: ResHttp, r: RespuestaLti): void {
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer');
  if (r.tipo === 'redireccion') {
    res.redirect(302, r.url);
    return;
  }
  res.set('Content-Type', 'text/html; charset=utf-8').set('Content-Security-Policy', CSP).set('X-Content-Type-Options', 'nosniff');
  if (r.tipo === 'abrir') {
    res.status(200).send(paginaRedireccion(r.destino));
    return;
  }
  // Solo el código: nada de datos de la persona en los logs.
  console.warn('lti: rechazado', r.error);
  res.status(400).send(paginaError(r.error));
}

export const ltiLogin = onRequest(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).set('Allow', 'GET, POST').send('');
    return;
  }
  try {
    responder(res, await procesarLogin(dependenciasReales(), parametrosDe(req)));
  } catch (e) {
    console.error('ltiLogin: fallo', e instanceof Error ? e.message : String(e));
    res.status(500).set('Content-Type', 'text/html; charset=utf-8').send(paginaError('error_interno'));
  }
});

export const ltiLaunch = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).set('Allow', 'POST').send('');
    return;
  }
  try {
    responder(res, await procesarLanzamiento(dependenciasReales(), parametrosDe({ body: req.body })));
  } catch (e) {
    console.error('ltiLaunch: fallo', e instanceof Error ? e.message : String(e));
    res.status(500).set('Content-Type', 'text/html; charset=utf-8').send(paginaError('error_interno'));
  }
});
