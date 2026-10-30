/**
 * Fase 8c — biblioteca pública de mundos: profes de todo el país comparten sus
 * mundos propios. Reusa la de la entidad (dominio/biblioteca.ts): la misma
 * publicación y la misma copia en borrador, con sus ámbitos del MEN.
 *
 * - `bibliotecaPublica/{id}`: la ficha (sin las piezas), que lee cualquier profe.
 * - `bibliotecaPublica/{id}/contenido/piezas`: las piezas, solo el servidor.
 *
 * Publica quien tenga `bibliotecaPublicar` (Comandante, Nave o un plan de
 * entidad); copiar a una clase es crear un mundo propio (`mundosPropios`,
 * Piloto o más); verla es de todos los planes. Con 3 reportes de profes
 * distintos se oculta hasta que Ceti la revise. Nada de estudiantes. Puro.
 */
import type { PublicacionBiblioteca } from './biblioteca';
import { grupoGradoMen, type GrupoGradoMen } from './normativa';

export const UMBRAL_REPORTES = 3;
export const MAX_MOTIVO_REPORTE = 200;

export type FichaPublica = Omit<PublicacionBiblioteca, 'piezas'> & {
  /** Nombre de la institución, si el autor quiso mostrarlo. */
  institucion: string | null;
  grupoGrados: GrupoGradoMen | null;
  /** Para buscar: título, subtítulo y descripción en minúsculas y sin tildes. */
  buscable: string;
  reportes: string[];
  oculto: boolean;
  colegioId: string;
};

export function normalizar(s: string): string {
  return s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** La ficha pública de una publicación (las piezas van aparte). */
export function fichaPublica(
  pub: PublicacionBiblioteca,
  extra: { institucion: string | null; colegioId: string; previa?: Partial<FichaPublica> | null }
): FichaPublica {
  const { piezas: _piezas, ...resto } = pub;
  const previa = extra.previa ?? null;
  const reportes = Array.isArray(previa?.reportes) ? previa.reportes : [];
  return {
    ...resto,
    // Volver a publicar conserva los usos y los reportes.
    usos: typeof previa?.usos === 'number' ? previa.usos : 0,
    institucion: extra.institucion?.trim() || null,
    grupoGrados: grupoGradoMen(pub.grado),
    buscable: normalizar([pub.titulo, pub.subtitulo, pub.descripcion].filter(Boolean).join(' ')),
    reportes,
    oculto: reportes.length >= UMBRAL_REPORTES,
    colegioId: extra.colegioId,
  };
}

/** Suma el reporte de un profe (uno por profe; el autor no se reporta a sí mismo). */
export function conReporte(
  ficha: Pick<FichaPublica, 'reportes' | 'autorUid'>,
  uid: string
): { reportes: string[]; oculto: boolean } | null {
  if (uid === ficha.autorUid || ficha.reportes.includes(uid)) return null;
  const reportes = [...ficha.reportes, uid];
  return { reportes, oculto: reportes.length >= UMBRAL_REPORTES };
}

export interface FiltroBiblioteca {
  texto?: string;
  grupo?: GrupoGradoMen | null;
  ambito?: string | null;
}

/** Busca por texto, grupo de grados y ámbito del MEN; los más usados primero. */
export function filtrarBiblioteca<T extends Pick<FichaPublica, 'buscable' | 'grupoGrados' | 'ambitosMen' | 'usos' | 'publicadoAt' | 'oculto'>>(
  fichas: readonly T[],
  f: FiltroBiblioteca
): T[] {
  const palabras = normalizar(f.texto ?? '').split(' ').filter(Boolean);
  return fichas
    .filter((x) => !x.oculto)
    .filter((x) => palabras.every((p) => x.buscable.includes(p)))
    .filter((x) => !f.grupo || x.grupoGrados === f.grupo)
    .filter((x) => !f.ambito || (x.ambitosMen ?? []).includes(f.ambito))
    .sort((a, b) => b.usos - a.usos || b.publicadoAt - a.publicadoAt);
}

/** Fase 9 — lo que ve el admin de Ceti de un mundo oculto (sin las piezas). */
export interface OcultoModeracion {
  id: string;
  titulo: string;
  autorNombre: string;
  institucion: string | null;
  usos: number;
  publicadoAt: number;
  reportes: { motivo: string | null; reportadoAt: number }[];
}
