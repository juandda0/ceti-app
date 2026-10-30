/**
 * Fase 9 — entrar con la cuenta de Google Workspace o Microsoft 365 de la
 * institución. El admin de la entidad registra el dominio de su propio correo
 * verificado (así prueba que es de ellos) y, cuando un profe entra con un
 * correo verificado de ese dominio, recibe la invitación a la entidad (no
 * entra solo: aceptar sigue igual que siempre). A los estudiantes no los toca:
 * ellos se unen a la clase con el código. Puro.
 *
 * Datos: `colegios/{cid}.entidad.dominios` (lo que ve el admin) y
 * `dominiosEntidad/{dominio}` → {colegioId} (único por dominio, solo servidor).
 */

export const MAX_DOMINIOS_ENTIDAD = 5;

/** Dominios de correo personal: nunca identifican a una institución. */
export const DOMINIOS_PUBLICOS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
] as const;

const DOMINIO = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export function dominioDeCorreo(correo: string | null | undefined): string | null {
  const c = (correo ?? '').trim().toLowerCase();
  const i = c.lastIndexOf('@');
  if (i < 1) return null;
  const d = c.slice(i + 1);
  return DOMINIO.test(d) ? d : null;
}

export type ErrorDominio = 'invalido' | 'publico' | 'no_es_tuyo' | 'sin_verificar' | 'lleno' | 'de_otra' | 'ya_esta';

export const MENSAJES_ERROR_DOMINIO: Record<ErrorDominio, string> = {
  invalido: 'Escribe el dominio así: micolegio.edu.co',
  publico: 'Ese es un correo personal (como gmail.com). Usa el dominio de la institución.',
  no_es_tuyo: 'Solo puedes agregar el dominio de tu propio correo institucional.',
  sin_verificar: 'Tu correo no está verificado. Entra con la cuenta de Google o Microsoft de la institución.',
  lleno: `Una entidad tiene hasta ${MAX_DOMINIOS_ENTIDAD} dominios.`,
  de_otra: 'Ese dominio ya lo usa otra entidad en Ceti. Escríbenos si es un error.',
  ya_esta: 'Ese dominio ya está agregado.',
};

export function limpiarDominio(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return DOMINIO.test(d) ? d : null;
}

/** ¿El admin puede agregar este dominio? Solo el de su propio correo verificado. */
export function puedeAgregarDominio(
  dominio: unknown,
  admin: { correo: string | null; verificado: boolean },
  actuales: readonly string[],
  duenoActual: string | null,
  colegioId: string
): { ok: true; dominio: string } | { ok: false; error: ErrorDominio } {
  const d = limpiarDominio(dominio);
  if (!d) return { ok: false, error: 'invalido' };
  if ((DOMINIOS_PUBLICOS as readonly string[]).includes(d)) return { ok: false, error: 'publico' };
  if (!admin.verificado) return { ok: false, error: 'sin_verificar' };
  if (dominioDeCorreo(admin.correo) !== d) return { ok: false, error: 'no_es_tuyo' };
  if (actuales.includes(d)) return { ok: false, error: 'ya_esta' };
  if (duenoActual && duenoActual !== colegioId) return { ok: false, error: 'de_otra' };
  if (actuales.length >= MAX_DOMINIOS_ENTIDAD) return { ok: false, error: 'lleno' };
  return { ok: true, dominio: d };
}

/**
 * ¿A este profe le toca una invitación por dominio? Solo con correo
 * verificado, si no es ya de esa entidad y no la rechazó antes.
 */
export function tocaInvitacionPorDominio(p: {
  correo: string | null;
  verificado: boolean;
  colegioActual: string;
  entidadDelDominio: string | null;
  yaInvitado: boolean;
  rechazada: boolean;
}): boolean {
  if (!p.verificado || !p.correo || !p.entidadDelDominio) return false;
  if (p.entidadDelDominio === p.colegioActual) return false;
  return !p.yaInvitado && !p.rechazada;
}
