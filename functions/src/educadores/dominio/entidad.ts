/**
 * Fase 6 — entidades: colegios, universidades y academias con varios profes.
 * Puro: sin Firebase.
 *
 * Modelo: cada profe tiene su propio "colegio" en Ceti (resolveMyAccess lo crea
 * al registrarse). Una entidad es un colegio compartido: el admin convierte el
 * suyo (`colegios/{cid}.entidad`) y los profes invitados pasan a compartirlo
 * (sus clases se mudan con ellos). Así la licencia, la escala, la biblioteca,
 * los co-docentes y el panel cuelgan del mismo `colegioId` que ya usa todo.
 *
 * El admin de la entidad es un permiso de una cuenta de profesor
 * (`colegios/{cid}/profes/{uid}.rol == 'admin'`), no un rol nuevo: la app sigue
 * con 3 roles (D-PIVOT). Puede no tener clases y puede haber varios.
 */
import { DIA_MS } from './calendario';
import { esPlanEntidad, type CicloEntidad, type PlanEntidad } from './precios';
import type { PlanId } from './planes';

export const TIPOS_ENTIDAD = ['colegio', 'universidad', 'academia'] as const;
export type TipoEntidad = (typeof TIPOS_ENTIDAD)[number];

export function esTipoEntidad(v: unknown): v is TipoEntidad {
  return typeof v === 'string' && (TIPOS_ENTIDAD as readonly string[]).includes(v);
}

export const ROLES_ENTIDAD = ['admin', 'profe'] as const;
export type RolEntidad = (typeof ROLES_ENTIDAD)[number];

export function esRolEntidad(v: unknown): v is RolEntidad {
  return typeof v === 'string' && (ROLES_ENTIDAD as readonly string[]).includes(v);
}

/** `colegios/{cid}.entidad`. */
export interface DatosEntidad {
  nombre: string;
  tipo: TipoEntidad;
  creadaAt: number;
  creadaPor: string;
  /** Fase 9: dominios de correo de la institución (ver ssoEntidad.ts). */
  dominios?: string[];
}

/** `colegios/{cid}/profes/{uid}`. */
export interface ProfeEntidad {
  uid: string;
  nombre: string;
  correo: string | null;
  rol: RolEntidad;
  unidoAt: number;
}

/** `colegios/{cid}/invitacionesProfe/{correo}`. */
export interface InvitacionProfe {
  correo: string;
  rol: RolEntidad;
  invitadoPor: string;
  invitadoPorNombre: string | null;
  creadaAt: number;
}

/**
 * Licencia de la entidad en `colegios/{cid}.licencia`. Las de antes de la Fase 6
 * traen `plan: 'nave'` (= Colegio) y `estudiantes` como cupo.
 */
export interface LicenciaEntidad {
  plan: PlanEntidad | 'nave';
  hasta: number;
  ciclo?: CicloEntidad | null;
  /** Unidades pagadas: profes (Equipo) o estudiantes (Colegio, Universidad). */
  cupo?: number | null;
  /** Licencias Nave de antes: estudiantes del contrato. */
  estudiantes?: number;
  padrino?: string | null;
  cotizacionId?: string | null;
}

/** El plan de entidad de una licencia ('nave' de antes = Colegio); null si no es de entidad. */
export function planEntidadDe(l: { plan?: unknown } | null | undefined): PlanEntidad | null {
  if (!l) return null;
  if (l.plan === 'nave') return 'colegio';
  return esPlanEntidad(l.plan) ? l.plan : null;
}

/** La licencia si existe y sigue vigente en `ahora`. */
export function licenciaVigente<T extends { plan?: unknown; hasta?: unknown }>(
  l: T | null | undefined,
  ahora: number
): T | null {
  if (!l || planEntidadDe(l) === null) return null;
  return typeof l.hasta === 'number' && ahora < l.hasta ? l : null;
}

/**
 * Plan que le da la licencia a cada profe de la entidad: Equipo = todo
 * Comandante (incluye el resumen para acudientes); Colegio y Universidad = Nave.
 */
export function planDeLicencia(l: { plan?: unknown; hasta?: unknown } | null | undefined, ahora: number): PlanId {
  const v = licenciaVigente(l, ahora);
  if (!v) return 'cadete';
  return planEntidadDe(v) === 'equipo' ? 'comandante' : 'nave';
}

/** ¿La licencia pone tope de estudiantes (Colegio y Universidad)? Equipo cobra por profe. */
export function topeEstudiantesDe(l: LicenciaEntidad | null | undefined): number | null {
  const plan = planEntidadDe(l);
  if (!l || plan === null || plan === 'equipo') return null;
  const n = l.cupo ?? l.estudiantes;
  return typeof n === 'number' && n > 0 ? n : null;
}

/** Profes que puede tener una entidad sin licencia (para probar y pedir la cotización). */
export const PROFES_SIN_LICENCIA = 3;

/** Cupo de profes: Equipo paga por profe; Colegio y Universidad, ilimitados. */
export function cupoProfes(l: LicenciaEntidad | null | undefined, ahora: number): number {
  const v = licenciaVigente(l, ahora);
  if (!v) return PROFES_SIN_LICENCIA;
  if (planEntidadDe(v) !== 'equipo') return Number.POSITIVE_INFINITY;
  return Math.max(typeof v.cupo === 'number' ? v.cupo : 0, PROFES_SIN_LICENCIA);
}

export type ErrorEntidad =
  | 'sin_cupo'
  | 'ya_es_miembro'
  | 'ya_invitado'
  | 'correo_invalido'
  | 'ultimo_admin'
  | 'no_es_miembro'
  | 'nombre_invalido';

export const MENSAJES_ERROR_ENTIDAD: Record<ErrorEntidad, string> = {
  sin_cupo: 'No quedan cupos de profes. Amplía el plan de la entidad para invitar a más.',
  ya_es_miembro: 'Ese profe ya está en la entidad.',
  ya_invitado: 'Ya hay una invitación para ese correo.',
  correo_invalido: 'Revisa el correo.',
  ultimo_admin: 'La entidad necesita al menos un admin.',
  no_es_miembro: 'Ese profe no está en la entidad.',
  nombre_invalido: 'El nombre debe tener entre 3 y 80 caracteres.',
};

type Resultado<T = true> = { ok: true; valor: T } | { ok: false; error: ErrorEntidad };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarCorreo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const c = v.trim().toLowerCase();
  return c.length <= 254 && CORREO.test(c) ? c : null;
}

export function limpiarNombreEntidad(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const n = v.replace(/\s+/g, ' ').trim();
  return n.length >= 3 && n.length <= 80 ? n : null;
}

/** ¿Se puede invitar a `correo`? Las invitaciones pendientes también ocupan cupo. */
export function puedeInvitar(
  correo: unknown,
  profes: readonly Pick<ProfeEntidad, 'correo'>[],
  pendientes: readonly Pick<InvitacionProfe, 'correo'>[],
  licencia: LicenciaEntidad | null | undefined,
  ahora: number
): Resultado<string> {
  const c = normalizarCorreo(correo);
  if (!c) return { ok: false, error: 'correo_invalido' };
  if (profes.some((p) => p.correo?.toLowerCase() === c)) return { ok: false, error: 'ya_es_miembro' };
  if (pendientes.some((p) => p.correo === c)) return { ok: false, error: 'ya_invitado' };
  if (profes.length + pendientes.length >= cupoProfes(licencia, ahora)) {
    return { ok: false, error: 'sin_cupo' };
  }
  return { ok: true, valor: c };
}

/** Cambiar el rol de un miembro sin dejar la entidad sin admin. */
export function validarCambioRol(
  profes: readonly Pick<ProfeEntidad, 'uid' | 'rol'>[],
  uid: string,
  rol: RolEntidad
): Resultado {
  const p = profes.find((x) => x.uid === uid);
  if (!p) return { ok: false, error: 'no_es_miembro' };
  const admins = profes.filter((x) => x.rol === 'admin').length;
  if (p.rol === 'admin' && rol !== 'admin' && admins <= 1) return { ok: false, error: 'ultimo_admin' };
  return { ok: true, valor: true };
}

/** Sacar a un miembro (o salir uno mismo) sin dejar la entidad sin admin. */
export function validarSalida(profes: readonly Pick<ProfeEntidad, 'uid' | 'rol'>[], uid: string): Resultado {
  const p = profes.find((x) => x.uid === uid);
  if (!p) return { ok: false, error: 'no_es_miembro' };
  const admins = profes.filter((x) => x.rol === 'admin').length;
  if (p.rol === 'admin' && admins <= 1 && profes.length > 1) return { ok: false, error: 'ultimo_admin' };
  return { ok: true, valor: true };
}

/**
 * Qué pasa con los profes de una clase cuando un miembro sale de la entidad. La
 * clase se queda en la entidad: se quita al que sale y, si se queda sin profes,
 * pasa a `pasarA` (o queda sin profe hasta que un admin la asigne).
 */
export function profesTrasSalida(profesorUids: readonly string[], sale: string, pasarA: string | null): string[] {
  const quedan = profesorUids.filter((u) => u !== sale);
  if (quedan.length > 0) return quedan;
  return pasarA && pasarA !== sale ? [pasarA] : [];
}

// ---------------------------------------------------------------------------
// Co-docentes
// ---------------------------------------------------------------------------

export const MAX_PROFES_POR_CLASE = 6;

export type ErrorCoDocente = 'no_es_miembro' | 'ya_esta' | 'no_esta' | 'ultimo_profe' | 'clase_llena';

export const MENSAJES_ERROR_CODOCENTE: Record<ErrorCoDocente, string> = {
  no_es_miembro: 'Solo puedes sumar profes de tu entidad.',
  ya_esta: 'Ese profe ya está en la clase.',
  no_esta: 'Ese profe no está en la clase.',
  ultimo_profe: 'La clase necesita al menos un profe.',
  clase_llena: `Una clase tiene hasta ${MAX_PROFES_POR_CLASE} profes.`,
};

/** Nueva lista de profes de la clase, o el error. Quitar nunca deja la clase sin profe. */
export function cambiarCoDocente(
  profesorUids: readonly string[],
  miembros: ReadonlySet<string>,
  uid: string,
  accion: 'agregar' | 'quitar'
): { ok: true; profesorUids: string[] } | { ok: false; error: ErrorCoDocente } {
  if (accion === 'agregar') {
    if (!miembros.has(uid)) return { ok: false, error: 'no_es_miembro' };
    if (profesorUids.includes(uid)) return { ok: false, error: 'ya_esta' };
    if (profesorUids.length >= MAX_PROFES_POR_CLASE) return { ok: false, error: 'clase_llena' };
    return { ok: true, profesorUids: [...profesorUids, uid] };
  }
  if (!profesorUids.includes(uid)) return { ok: false, error: 'no_esta' };
  if (profesorUids.length <= 1) return { ok: false, error: 'ultimo_profe' };
  return { ok: true, profesorUids: profesorUids.filter((u) => u !== uid) };
}

// ---------------------------------------------------------------------------
// Invitación vencida
// ---------------------------------------------------------------------------

export const DIAS_INVITACION_PROFE = 30;

export function invitacionVigente(inv: Pick<InvitacionProfe, 'creadaAt'>, ahora: number): boolean {
  return ahora - inv.creadaAt <= DIAS_INVITACION_PROFE * DIA_MS;
}
