/**
 * LTI 1.3 — la parte con `node:crypto` (ver ./lti.ts): id de la plataforma,
 * valores aleatorios, lectura del JWT y su firma RS256 contra el JWKS del LMS.
 * Puro (sin Firebase) pero solo servidor: el cliente no debe importarlo.
 */
import { createHash, createPublicKey, randomBytes, verify, type KeyObject, type webcrypto } from 'node:crypto';

/** sha256(issuer|clientId) en hex, 32 caracteres: el id de `ltiPlataformas`. */
export function plataformaIdDe(issuer: string, clientId: string): string {
  return createHash('sha256').update(`${issuer}|${clientId}`).digest('hex').slice(0, 32);
}

/** state y nonce: 32 bytes aleatorios en base64url (43 caracteres). */
export function aleatorio(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export interface Jwk extends webcrypto.JsonWebKey {
  kid?: string;
}

export interface Jwks {
  keys: Jwk[];
}

export function esJwks(v: unknown): v is Jwks {
  return !!v && typeof v === 'object' && Array.isArray((v as { keys?: unknown }).keys);
}

export interface JwtDecodificado {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** `header.payload` tal como vino: lo que se firmó. */
  firmado: string;
  firma: Buffer;
}

/** Un id_token es pequeño; esto corta tokens absurdos antes de decodificar. */
export const MAX_LARGO_JWT = 20_000;

const B64URL = /^[A-Za-z0-9_-]+$/;

function objetoJson(parte: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(parte, 'base64url').toString('utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Separa y decodifica un JWT compacto (sin verificar nada); null si no lo es. */
export function decodificarJwt(token: unknown): JwtDecodificado | null {
  if (typeof token !== 'string' || token.length > MAX_LARGO_JWT) return null;
  const partes = token.split('.');
  if (partes.length !== 3 || !partes.every((p) => B64URL.test(p))) return null;
  const header = objetoJson(partes[0]);
  const payload = objetoJson(partes[1]);
  if (!header || !payload) return null;
  return { header, payload, firmado: `${partes[0]}.${partes[1]}`, firma: Buffer.from(partes[2], 'base64url') };
}

function llavePublica(jwk: Jwk): KeyObject | null {
  try {
    const k = createPublicKey({ key: jwk, format: 'jwk' });
    // Llaves RSA de menos de 2048 bits no se aceptan.
    return k.asymmetricKeyType === 'rsa' && (k.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048 ? k : null;
  } catch {
    return null;
  }
}

export type ResultadoFirma =
  | { ok: true }
  | { ok: false; error: 'algoritmo_no_soportado' | 'llave_desconocida' | 'firma_invalida' };

/**
 * Verifica la firma RS256 con la llave del JWKS que dice el `kid` del header;
 * sin kid, solo si el JWKS tiene una única llave RSA de firma. Cualquier otro
 * alg (none, HS256…) se rechaza.
 */
export function verificarFirmaRs256(jwt: JwtDecodificado, jwks: Jwks): ResultadoFirma {
  if (jwt.header.alg !== 'RS256') return { ok: false, error: 'algoritmo_no_soportado' };
  const candidatas = jwks.keys.filter(
    (k) => k && k.kty === 'RSA' && (k.use === undefined || k.use === 'sig') && (k.alg === undefined || k.alg === 'RS256')
  );
  const kid = jwt.header.kid;
  const jwk =
    typeof kid === 'string' ? candidatas.find((k) => k.kid === kid) : candidatas.length === 1 ? candidatas[0] : undefined;
  const llave = jwk ? llavePublica(jwk) : null;
  if (!llave) return { ok: false, error: 'llave_desconocida' };
  const valida = verify('RSA-SHA256', Buffer.from(jwt.firmado, 'utf8'), llave, jwt.firma);
  return valida ? { ok: true } : { ok: false, error: 'firma_invalida' };
}
