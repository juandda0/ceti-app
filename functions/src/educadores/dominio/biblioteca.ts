/**
 * Fase 6 — biblioteca de mundos de la entidad. Un profe publica una copia de un
 * mundo propio (`cw_*`) de su clase; cualquier profe de la entidad la copia a
 * sus clases como un mundo nuevo en borrador. Son copias: cambiar una no toca
 * las otras. No lleva nada de estudiantes. Puro.
 */

export const MUNDOS_POR_DEFECTO = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5', 'world_6'] as const;
export const MAX_MUNDOS_CLASE = 30;
/** Firestore admite 1 MiB por documento; se deja margen. */
export const MAX_BYTES_PUBLICACION = 900_000;

export interface PiezaContenido {
  id: string;
  data: Record<string, unknown>;
}

export interface EntradaMundo {
  worldId: string;
  activo: boolean;
  nombre?: string;
  subtitle?: string;
  descripcion?: string;
  competencia?: string;
  /** Ámbitos del MEN de un mundo propio (Fase 7). */
  ambitosMen?: string[];
  [k: string]: unknown;
}

export interface ConfigMundosDoc {
  mundos: EntradaMundo[];
  overrides?: Record<string, Record<string, boolean>>;
  version: number;
  updatedAt: number;
  updatedByUid: string;
}

export interface PublicacionBiblioteca {
  titulo: string;
  subtitulo: string | null;
  descripcion: string | null;
  competencia: string | null;
  /** Fase 7: viajan con la copia para que siga sumando en la cobertura. */
  ambitosMen?: string[];
  grado: string | null;
  autorUid: string;
  autorNombre: string;
  origen: { cursoId: string; worldId: string };
  /** docId → contenido, con el worldId original. */
  piezas: Record<string, Record<string, unknown>>;
  overrides: Record<string, boolean>;
  lecciones: number;
  preguntas: number;
  publicadoAt: number;
  usos: number;
}

/** Las piezas de contenido de un mundo (banco_*, microteoria_*, mapa_*, eligeCamino_*). */
export function piezasDeMundo(docs: readonly PiezaContenido[], worldId: string): PiezaContenido[] {
  return docs.filter(
    (d) =>
      d.data.worldId === worldId &&
      (d.id === `microteoria_${worldId}` ||
        d.id === `mapa_${worldId}` ||
        d.id === `eligeCamino_${worldId}` ||
        d.id.startsWith(`banco_${worldId}_`))
  );
}

/** Cuenta lecciones (del mapa, si hay) y preguntas (de los bancos). */
export function contarMundo(piezas: readonly PiezaContenido[]): { lecciones: number; preguntas: number } {
  let preguntas = 0;
  let lecciones = 0;
  for (const p of piezas) {
    if (p.id.startsWith('banco_') && Array.isArray(p.data.items)) preguntas += p.data.items.length;
    if (p.id.startsWith('mapa_') && Array.isArray(p.data.lecciones)) lecciones = p.data.lecciones.length;
  }
  return { lecciones, preguntas };
}

export function armarPublicacion(params: {
  entrada: EntradaMundo;
  piezas: readonly PiezaContenido[];
  overrides: Record<string, boolean> | undefined;
  grado: string | null;
  cursoId: string;
  autorUid: string;
  autorNombre: string;
  ahora: number;
}): PublicacionBiblioteca {
  const { entrada, piezas } = params;
  return {
    titulo: (entrada.nombre ?? '').trim() || 'Mundo sin nombre',
    subtitulo: entrada.subtitle?.trim() || null,
    descripcion: entrada.descripcion?.trim() || null,
    competencia: entrada.competencia ?? null,
    ...(Array.isArray(entrada.ambitosMen) && entrada.ambitosMen.length ? { ambitosMen: [...entrada.ambitosMen] } : {}),
    grado: params.grado,
    autorUid: params.autorUid,
    autorNombre: params.autorNombre,
    origen: { cursoId: params.cursoId, worldId: entrada.worldId },
    piezas: Object.fromEntries(piezas.map((p) => [p.id, p.data])),
    overrides: { ...(params.overrides ?? {}) },
    ...contarMundo(piezas),
    publicadoAt: params.ahora,
    usos: 0,
  };
}

/** Las piezas de una publicación con el id del mundo nuevo (ids de las preguntas intactos). */
export function piezasParaMundoNuevo(pub: Pick<PublicacionBiblioteca, 'piezas' | 'origen'>, nuevo: string): PiezaContenido[] {
  const viejo = pub.origen.worldId;
  return Object.entries(pub.piezas).map(([id, data]) => ({
    id: id.replace(viejo, nuevo),
    data: { ...data, worldId: nuevo },
  }));
}

/**
 * La configuración de la clase con el mundo copiado al final, en borrador (los
 * estudiantes no lo ven hasta que el profe lo active). Sin configuración, parte
 * de los 5 mundos de Ceti. Devuelve null si la clase ya tiene 30 mundos.
 */
export function configConMundo(
  actual: Partial<ConfigMundosDoc> | null | undefined,
  pub: Pick<PublicacionBiblioteca, 'titulo' | 'subtitulo' | 'descripcion' | 'competencia' | 'overrides' | 'ambitosMen'>,
  nuevo: string,
  uid: string,
  ahora: number
): ConfigMundosDoc | null {
  const mundos: EntradaMundo[] =
    Array.isArray(actual?.mundos) && actual.mundos.length > 0
      ? [...actual.mundos]
      : MUNDOS_POR_DEFECTO.map((worldId) => ({ worldId, activo: true }));
  if (mundos.length >= MAX_MUNDOS_CLASE) return null;
  const entrada: EntradaMundo = { worldId: nuevo, activo: false, nombre: pub.titulo };
  if (pub.subtitulo) entrada.subtitle = pub.subtitulo;
  if (pub.descripcion) entrada.descripcion = pub.descripcion;
  if (pub.competencia) entrada.competencia = pub.competencia;
  if (pub.ambitosMen?.length) entrada.ambitosMen = [...pub.ambitosMen];
  return {
    mundos: [...mundos, entrada],
    overrides: { ...(actual?.overrides ?? {}), [nuevo]: { ...pub.overrides } },
    version: (typeof actual?.version === 'number' ? actual.version : 0) + 1,
    updatedAt: ahora,
    updatedByUid: uid,
  };
}
