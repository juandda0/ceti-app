/**
 * Fase 8c — adaptaciones por estudiante y accesibilidad de la clase.
 *
 * - `cursos/{k}/estudiantes/{uid}/adaptaciones/actual`: las pone cualquier profe
 *   de la clase; las lee el estudiante. Aplican solo en el espacio de la clase
 *   (lecciones, jefe y clase en vivo), nunca en «Mi galaxia».
 * - `cursos/{k}/config/accesibilidad`: «leer en voz alta» para toda la clase.
 *   Sin documento, viene encendido en 1° a 3° (casi no leen todavía).
 *
 * No cambian la nota ni lo que cuenta en los informes. Puro: sin Firebase.
 */

export const ADAPTACIONES = ['masTiempo', 'menosOpciones', 'leerEnVozAlta', 'letraGrande'] as const;
export type Adaptacion = (typeof ADAPTACIONES)[number];

export type MapaAdaptaciones = Record<Adaptacion, boolean>;

export interface DocAdaptaciones extends MapaAdaptaciones {
  actualizadoAt: number;
  actualizadoPor: string;
}

export interface ConfigAccesibilidad {
  leerEnVozAlta: boolean;
  actualizadoAt: number;
  actualizadoPor: string;
}

export const SIN_ADAPTACIONES: MapaAdaptaciones = {
  masTiempo: false,
  menosOpciones: false,
  leerEnVozAlta: false,
  letraGrande: false,
};

export function adaptacionesDesdeDoc(d: unknown): MapaAdaptaciones {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  return Object.fromEntries(ADAPTACIONES.map((a) => [a, o[a] === true])) as MapaAdaptaciones;
}

export function cuantasActivas(a: MapaAdaptaciones): number {
  return ADAPTACIONES.filter((k) => a[k]).length;
}

/** 1° a 3° («1», «2», «3» o «transicion») traen la voz encendida para toda la clase. */
export function vozPorDefecto(grado: string | null | undefined): boolean {
  return grado === '1' || grado === '2' || grado === '3' || grado === 'transicion';
}

/** ¿La clase lee en voz alta? Lo que puso el profe, o lo del grado si no puso nada. */
export function vozDeClase(config: Partial<ConfigAccesibilidad> | null | undefined, grado: string | null | undefined): boolean {
  return typeof config?.leerEnVozAlta === 'boolean' ? config.leerEnVozAlta : vozPorDefecto(grado);
}

/** Lo que aplica a un estudiante: lo suyo más la voz de la clase. */
export function adaptacionesEfectivas(
  propias: MapaAdaptaciones | null | undefined,
  vozClase: boolean
): MapaAdaptaciones {
  const base = propias ?? SIN_ADAPTACIONES;
  return { ...base, leerEnVozAlta: base.leerEnVozAlta || vozClase };
}

/**
 * «Menos opciones» en una pregunta de opción múltiple de 4 o más: el índice de
 * una errada que no se muestra (la misma siempre para esa pregunta). Los índices
 * no cambian, así el profe sigue viendo qué eligió el estudiante.
 */
export function erradaAEsconder(id: string, nOpciones: number, correcta: number): number | null {
  if (nOpciones < 4 || correcta < 0 || correcta >= nOpciones) return null;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const erradas = Array.from({ length: nOpciones }, (_, i) => i).filter((i) => i !== correcta);
  return erradas[(h >>> 0) % erradas.length];
}
