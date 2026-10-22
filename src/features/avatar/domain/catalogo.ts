/**
 * Catálogo del avatar: personajes elegibles, tonos de piel, prendas y
 * accesorios. Alcance de lanzamiento a propósito pequeño.
 *
 * Cada prenda de cada personaje es un dibujo completo (assets/brand/<p>/…) con
 * sus propios ojos y su propia familia de piel. Si se vuelve a vectorizar un
 * dibujo, hay que revisar aquí sus ojos y su piel (biblias en docs/marca).
 */
import type { AccesorioId, AnclaOjos } from './accesorios';

export type PersonajeId = 'juan' | 'santiago' | 'sofi' | 'vale';
export type TonoPielId = 'original' | 'clara' | 'media' | 'canela' | 'morena' | 'oscura';
export type ColorPeloId = 'original' | 'negro' | 'castano' | 'rubio' | 'pelirrojo' | 'azul';
export type PrendaId = 'traje' | 'sudadera';
export type ItemId = PrendaId | AccesorioId;

/** Datos de un dibujo concreto (personaje + prenda). */
export type Arte = {
  ancho: number;
  alto: number;
  ojos: AnclaOjos;
  /**
   * `familia`: tonos de piel que se recolorean en todo el SVG.
   * `soloCabeza`: tonos que también usa la ropa (cuello, costuras) y por eso
   * solo se recolorean dentro del grupo `cabeza` (barba, boca…).
   */
  piel: { base: string; familia: readonly string[]; soloCabeza?: readonly string[] };
  /** Tonos del pelo (y cejas cuando son del color del pelo); `soloCabeza` como en la piel. */
  pelo: { base: string; familia: readonly string[]; soloCabeza?: readonly string[] };
};

export type Personaje = {
  id: PersonajeId;
  nombre: string;
  /** Clave i18n del rol en la nave. */
  rol: 'capitan' | 'navegante' | 'ingeniera';
  /** Una prenda sin arte todavía no aparece en el vestidor de ese personaje. */
  prendas: { traje: Arte } & Partial<Record<Exclude<PrendaId, 'traje'>, Arte>>;
};

// La sudadera copia la cabeza del traje tal cual (assets/brand/<p>/<p>-sudadera.svg), así que
// comparte ojos y familias; sus manos son de piel con la base y el borde de la familia.

const JUAN: Arte = {
  ancho: 460,
  alto: 780,
  ojos: { cx: 218, cy: 163, sep: 83 },
  piel: {
    base: '#F4B596',
    familia: ['#C46F5B', '#EC917A', '#E8977E', '#E8977C', '#9E5546', '#D27F69'],
  },
  pelo: { base: '#BA8C5E', familia: ['#8C6340', '#C69A6B'] },
};

const SANTIAGO: Arte = {
  ancho: 520,
  alto: 790,
  ojos: { cx: 236.25, cy: 186.5, sep: 80.5 },
  piel: {
    base: '#EEAD8F',
    familia: [
      '#B06A5C',
      '#B17363',
      '#B5705F',
      '#B67463',
      '#CD8D74',
      '#DB9A7F',
      '#B27361',
      '#D58F7B',
      '#6B3326',
    ],
    // Mandíbula, barba y boca comparten tono con guantes y costuras del traje.
    soloCabeza: ['#A96B59', '#C39580', '#BD866D'],
  },
  pelo: { base: '#342626', familia: ['#1E1515'] },
};

const SOFI: Arte = {
  ancho: 520,
  alto: 790,
  ojos: { cx: 236.25, cy: 177, sep: 83.5 },
  piel: {
    base: '#F6B69C',
    familia: ['#C47F70', '#B56D61', '#BA7467', '#DB947F', '#EE9683', '#D97989'],
  },
  // El borde del pelo es el mismo negro del cordón del collar.
  pelo: { base: '#272727', familia: [], soloCabeza: ['#191817'] },
};

const VALE: Arte = {
  ancho: 520,
  alto: 790,
  ojos: { cx: 235.9, cy: 178.7, sep: 83.8 },
  piel: {
    base: '#F0B095',
    familia: [
      '#B97567',
      '#D99780',
      '#CD886C',
      '#93504F',
      '#C77672',
      '#D4837B',
      '#A5615A',
      '#8A4B44',
    ],
  },
  // El pelo largo cae también en cuerpo y brazos.
  pelo: { base: '#2B2B2B', familia: ['#51423F'] },
};

export const PERSONAJES: readonly Personaje[] = [
  { id: 'juan', nombre: 'Juan', rol: 'capitan', prendas: { traje: JUAN, sudadera: JUAN } },
  {
    id: 'santiago',
    nombre: 'Santiago',
    rol: 'capitan',
    prendas: { traje: SANTIAGO, sudadera: SANTIAGO },
  },
  { id: 'sofi', nombre: 'Sofi', rol: 'navegante', prendas: { traje: SOFI, sudadera: SOFI } },
  { id: 'vale', nombre: 'Vale', rol: 'ingeniera', prendas: { traje: VALE, sudadera: VALE } },
];

/** `original` deja la piel como la dibujó la hoja de modelo (`hex: null`). */
export const TONOS_PIEL: readonly { id: TonoPielId; hex: string | null }[] = [
  { id: 'original', hex: null },
  { id: 'clara', hex: '#F8CDB3' },
  { id: 'media', hex: '#E3A27A' },
  { id: 'canela', hex: '#C2835A' },
  { id: 'morena', hex: '#94593A' },
  { id: 'oscura', hex: '#653B26' },
];

/** `original` deja el pelo como en la hoja de modelo (`hex: null`). */
export const COLORES_PELO: readonly { id: ColorPeloId; hex: string | null }[] = [
  { id: 'original', hex: null },
  { id: 'negro', hex: '#2E2626' },
  { id: 'castano', hex: '#6B4229' },
  { id: 'rubio', hex: '#E0B565' },
  { id: 'pelirrojo', hex: '#C2582C' },
  { id: 'azul', hex: '#3F6FD6' },
];

export type Requisito =
  | { tipo: 'libre' }
  | { tipo: 'racha'; dias: number }
  | { tipo: 'dias-aprendiendo'; dias: number }
  | { tipo: 'meta-cumplida' };

export const PRENDAS: readonly { id: PrendaId; requisito: Requisito }[] = [
  { id: 'traje', requisito: { tipo: 'libre' } },
  { id: 'sudadera', requisito: { tipo: 'dias-aprendiendo', dias: 5 } },
];

export const ACCESORIOS: readonly { id: AccesorioId; requisito: Requisito }[] = [
  { id: 'gafas-sol', requisito: { tipo: 'libre' } },
  { id: 'gorra', requisito: { tipo: 'racha', dias: 3 } },
  { id: 'audifonos', requisito: { tipo: 'racha', dias: 7 } },
  { id: 'estrellas', requisito: { tipo: 'meta-cumplida' } },
];

export type AvatarConfig = {
  personaje: PersonajeId;
  tono: TonoPielId;
  pelo: ColorPeloId;
  prenda: PrendaId;
  accesorio: AccesorioId | null;
};

export const AVATAR_POR_DEFECTO: AvatarConfig = {
  personaje: 'juan',
  tono: 'original',
  pelo: 'original',
  prenda: 'traje',
  accesorio: null,
};

export function personajePorId(id: PersonajeId): Personaje {
  return PERSONAJES.find((p) => p.id === id) ?? PERSONAJES[0];
}

/** El dibujo a usar; si la prenda no tiene arte para ese personaje, cae al traje. */
export function arteDe(config: Pick<AvatarConfig, 'personaje' | 'prenda'>): {
  arte: Arte;
  prenda: PrendaId;
} {
  const p = personajePorId(config.personaje);
  const arte = p.prendas[config.prenda];
  return arte ? { arte, prenda: config.prenda } : { arte: p.prendas.traje, prenda: 'traje' };
}

export function requisitoDe(id: ItemId): Requisito {
  return (
    PRENDAS.find((p) => p.id === id)?.requisito ??
    ACCESORIOS.find((a) => a.id === id)?.requisito ?? { tipo: 'libre' }
  );
}

const IDS_PERSONAJE = new Set<string>(PERSONAJES.map((p) => p.id));
const IDS_TONO = new Set<string>(TONOS_PIEL.map((t) => t.id));
const IDS_PELO = new Set<string>(COLORES_PELO.map((c) => c.id));
const IDS_PRENDA = new Set<string>(PRENDAS.map((p) => p.id));
const IDS_ACCESORIO = new Set<string>(ACCESORIOS.map((a) => a.id));

/**
 * Lee un avatar guardado (perfil remoto o almacenamiento local) sin confiar en
 * su forma: lo que no se reconozca cae al valor por defecto. null si no hay
 * avatar o no es un objeto.
 */
export function leerAvatar(raw: unknown): AvatarConfig | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  if (!IDS_PERSONAJE.has(str(r.personaje))) return null;
  return {
    personaje: str(r.personaje) as PersonajeId,
    tono: IDS_TONO.has(str(r.tono)) ? (str(r.tono) as TonoPielId) : 'original',
    pelo: IDS_PELO.has(str(r.pelo)) ? (str(r.pelo) as ColorPeloId) : 'original',
    prenda: IDS_PRENDA.has(str(r.prenda)) ? (str(r.prenda) as PrendaId) : 'traje',
    accesorio: IDS_ACCESORIO.has(str(r.accesorio)) ? (str(r.accesorio) as AccesorioId) : null,
  };
}

/** Muestras de tono de piel para el personaje y prenda actuales (`original` = su tono). */
export function muestrasPiel(config: AvatarConfig): { id: TonoPielId; hex: string }[] {
  const { arte } = arteDe(config);
  return TONOS_PIEL.map((t) => ({ id: t.id, hex: t.hex ?? arte.piel.base }));
}

/** Muestras de color de pelo (`original` = el del personaje). */
export function muestrasPelo(config: AvatarConfig): { id: ColorPeloId; hex: string }[] {
  const { arte } = arteDe(config);
  return COLORES_PELO.map((c) => ({ id: c.id, hex: c.hex ?? arte.pelo.base }));
}
