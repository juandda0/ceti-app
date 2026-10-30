/**
 * Fase 9 — permisos de los profes de una clase. Cada profe de `profesorUids`
 * edita la clase, salvo los de `soloCalificar` (un subconjunto): esos ven todo
 * y califican, pero no cambian contenido, lista ni ajustes. Es un permiso por
 * clase, no un rol: la app sigue con 3 roles. Quien creó la clase
 * (`profesorUids[0]`) siempre edita y la clase nunca queda sin alguien que
 * edite. Las reglas (`isEditorDe`) y los callables lo hacen cumplir. Puro.
 */

export type PermisoClase = 'edita' | 'califica';

/** Lo que puede hacer quien ve y califica (todo lo demás es de quien edita). */
export const ACCIONES_CALIFICA = [
  'ver',
  'calificar',
  'retroalimentar',
  'insignias',
  'responderMuro',
] as const;

/** Lo que solo hace quien edita la clase. */
export const ACCIONES_EDITA = [
  'contenido',
  'requisitos',
  'tareas',
  'lista',
  'comunicar',
  'claseVivo',
  'grupos',
  'adaptaciones',
  'certificados',
  'prueba',
  'publicar',
  'acudientes',
  'ajustes',
  'profes',
] as const;

export type AccionClase = (typeof ACCIONES_CALIFICA)[number] | (typeof ACCIONES_EDITA)[number];

export interface CursoPermisos {
  profesorUids?: unknown;
  soloCalificar?: unknown;
}

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Permiso del profe en la clase, o null si no es profe de la clase. */
export function permisoEnClase(curso: CursoPermisos | undefined | null, uid: string): PermisoClase | null {
  const profes = lista(curso?.profesorUids);
  if (!profes.includes(uid)) return null;
  if (profes[0] === uid) return 'edita';
  return lista(curso?.soloCalificar).includes(uid) ? 'califica' : 'edita';
}

export function puedeEnClase(curso: CursoPermisos | undefined | null, uid: string, accion: AccionClase): boolean {
  const p = permisoEnClase(curso, uid);
  if (!p) return false;
  if (p === 'edita') return true;
  return (ACCIONES_CALIFICA as readonly string[]).includes(accion);
}

export type ErrorPermiso = 'no_esta' | 'es_creador' | 'sin_editor';

export const MENSAJES_ERROR_PERMISO: Record<ErrorPermiso, string> = {
  no_esta: 'Ese profe no está en la clase.',
  es_creador: 'Quien creó la clase siempre puede editarla.',
  sin_editor: 'La clase necesita al menos un profe que edite.',
};

/**
 * Nueva lista `soloCalificar` al cambiar el permiso de `uid`. Limpia de paso
 * los uids que ya no están en la clase.
 */
export function cambiarPermiso(
  curso: CursoPermisos,
  uid: string,
  permiso: PermisoClase
): { ok: true; soloCalificar: string[] } | { ok: false; error: ErrorPermiso } {
  const profes = lista(curso.profesorUids);
  if (!profes.includes(uid)) return { ok: false, error: 'no_esta' };
  const actuales = lista(curso.soloCalificar).filter((u) => profes.includes(u) && u !== profes[0]);
  if (permiso === 'edita') return { ok: true, soloCalificar: actuales.filter((u) => u !== uid) };
  if (profes[0] === uid) return { ok: false, error: 'es_creador' };
  const nuevos = actuales.includes(uid) ? actuales : [...actuales, uid];
  if (profes.every((u) => nuevos.includes(u))) return { ok: false, error: 'sin_editor' };
  return { ok: true, soloCalificar: nuevos };
}

/** `soloCalificar` tras quitar un profe de la clase (no deja uids sueltos). */
export function soloCalificarSin(curso: CursoPermisos, uid: string): string[] {
  return lista(curso.soloCalificar).filter((u) => u !== uid);
}
