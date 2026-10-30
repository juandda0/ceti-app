/**
 * Fase 8 — grupos dentro de la clase: `cursos/{k}/config/grupos`, que edita
 * cualquier profe de la clase (co-docentes) y lee la clase. Un estudiante está
 * en un solo grupo. Filtran el Análisis y la lista, abren «Escribirle al grupo»
 * y dan el ranking por grupos de la clase en vivo. Puro: sin Firebase.
 */

export const MAX_GRUPOS = 12;
export const MAX_NOMBRE_GRUPO = 30;
export const MAX_POR_GRUPO = 60;

/** Fauna de Colombia, para los nombres que se ponen solos. */
export const NOMBRES_GRUPO = [
  'Cóndores',
  'Jaguares',
  'Colibríes',
  'Tucanes',
  'Delfines rosados',
  'Guacamayas',
  'Osos de anteojos',
  'Manatíes',
  'Búhos',
  'Tortugas',
  'Ranas doradas',
  'Chigüiros',
] as const;

export const COLORES_GRUPO = [
  '#2F7BE5',
  '#2F9E5B',
  '#E5484D',
  '#D9901A',
  '#8E5BD8',
  '#1FA3A3',
  '#C2410C',
  '#DB2777',
  '#4D7C0F',
  '#0E7490',
  '#A16207',
  '#6D28D9',
] as const;

export interface Grupo {
  id: string;
  nombre: string;
  color: string;
  uids: string[];
}

export interface ConfigGrupos {
  grupos: Grupo[];
  actualizadoAt: number;
  actualizadoPor: string;
}

export type ErrorGrupos = 'demasiados' | 'nombre_vacio' | 'nombre_repetido' | 'en_dos_grupos' | 'grupo_lleno';

/** Revisa la lista antes de guardarla. */
export function validarGrupos(grupos: readonly Grupo[]): { ok: true } | { ok: false; error: ErrorGrupos } {
  if (grupos.length > MAX_GRUPOS) return { ok: false, error: 'demasiados' };
  const nombres = new Set<string>();
  const vistos = new Set<string>();
  for (const g of grupos) {
    const n = g.nombre.trim().toLocaleLowerCase('es');
    if (!n) return { ok: false, error: 'nombre_vacio' };
    if (nombres.has(n)) return { ok: false, error: 'nombre_repetido' };
    nombres.add(n);
    if (g.uids.length > MAX_POR_GRUPO) return { ok: false, error: 'grupo_lleno' };
    for (const u of g.uids) {
      if (vistos.has(u)) return { ok: false, error: 'en_dos_grupos' };
      vistos.add(u);
    }
  }
  return { ok: true };
}

function semillaDe(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

/** Un grupo nuevo vacío con el primer nombre y color libres. */
export function grupoNuevo(actuales: readonly Grupo[], id: string): Grupo {
  const usados = new Set(actuales.map((g) => g.nombre));
  const i = actuales.length;
  const nombre = NOMBRES_GRUPO.find((n) => !usados.has(n)) ?? `Grupo ${i + 1}`;
  return { id, nombre, color: COLORES_GRUPO[i % COLORES_GRUPO.length], uids: [] };
}

/** Reparte a los estudiantes en `n` grupos parejos, al azar pero repetible con la misma semilla. */
export function armarAlAzar(uids: readonly string[], n: number, semilla: string): Grupo[] {
  const k = Math.max(1, Math.min(MAX_GRUPOS, Math.floor(n)));
  const a = [...uids];
  let s = semillaDe(semilla);
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  const grupos = Array.from({ length: k }, (_, i) => ({
    id: `g${i + 1}`,
    nombre: NOMBRES_GRUPO[i] ?? `Grupo ${i + 1}`,
    color: COLORES_GRUPO[i % COLORES_GRUPO.length],
    uids: [] as string[],
  }));
  a.forEach((u, i) => grupos[i % k].uids.push(u));
  return grupos;
}

export function grupoDe(uid: string, grupos: readonly Grupo[] | null | undefined): Grupo | null {
  return grupos?.find((g) => g.uids.includes(uid)) ?? null;
}

/** Mueve a un estudiante a otro grupo (o a ninguno con `null`). */
export function moverA(grupos: readonly Grupo[], uid: string, destino: string | null): Grupo[] {
  return grupos.map((g) => {
    const sin = g.uids.filter((u) => u !== uid);
    return g.id === destino ? { ...g, uids: [...sin, uid] } : { ...g, uids: sin };
  });
}

/** Saca a un estudiante de todos los grupos (al salir de la clase o por la supresión Ley 1581). */
export function sinEstudiante(grupos: readonly Grupo[], uid: string): Grupo[] {
  return moverA(grupos, uid, null);
}

/** Quienes no están en ningún grupo, de una lista de estudiantes. */
export function sinGrupo(uids: readonly string[], grupos: readonly Grupo[]): string[] {
  const en = new Set(grupos.flatMap((g) => g.uids));
  return uids.filter((u) => !en.has(u));
}
