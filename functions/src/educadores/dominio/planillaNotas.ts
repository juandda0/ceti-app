/**
 * Fase 9 — planilla de notas para el sistema académico del colegio (Phidias,
 * Gnosoft, Sistema Saberes u otro). Ninguno publica un formato de
 * importación, así que el profe elige y ordena las columnas, y la planilla va
 * por apellidos, una fila por estudiante. Sale en Excel o en CSV con punto y
 * coma y coma decimal (Excel en español). Puro.
 */
import { ETIQUETA_DESEMPENO, type Desempeno } from './notas1290';

export const COLUMNAS_PLANILLA = ['apellidos', 'nombres', 'nombreCompleto', 'correo', 'nota', 'desempeno', 'observacion'] as const;
export type ColumnaPlanilla = (typeof COLUMNAS_PLANILLA)[number];

export const COLUMNAS_POR_DEFECTO: ColumnaPlanilla[] = ['apellidos', 'nombres', 'nota', 'desempeno'];

export const ENCABEZADO_COLUMNA: Record<ColumnaPlanilla, string> = {
  apellidos: 'Apellidos',
  nombres: 'Nombres',
  nombreCompleto: 'Nombre completo',
  correo: 'Correo',
  nota: 'Nota',
  desempeno: 'Desempeño',
  observacion: 'Observación',
};

export interface FilaPlanillaEntrada {
  nombre: string;
  correo: string | null;
  nota: number | null;
  desempeno: Desempeno | null;
  observacion: string;
}

/**
 * Nombres y apellidos de un nombre completo. En Colombia lo común es dos
 * nombres y dos apellidos: con 4 palabras o más, las dos últimas son
 * apellidos; con 3, la primera es el nombre; con 2, una y una.
 */
export function separarNombre(nombre: string): { nombres: string; apellidos: string } {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return { nombres: p[0] ?? '', apellidos: '' };
  if (p.length === 2) return { nombres: p[0], apellidos: p[1] };
  if (p.length === 3) return { nombres: p[0], apellidos: `${p[1]} ${p[2]}` };
  return { nombres: p.slice(0, -2).join(' '), apellidos: p.slice(-2).join(' ') };
}

export interface Planilla {
  encabezados: string[];
  filas: (string | number | null)[][];
}

export function armarPlanilla(entradas: readonly FilaPlanillaEntrada[], columnas: readonly ColumnaPlanilla[]): Planilla {
  const cols = columnas.length ? columnas : COLUMNAS_POR_DEFECTO;
  const conNombre = entradas.map((e) => ({ e, ...separarNombre(e.nombre) }));
  conNombre.sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es'));
  return {
    encabezados: cols.map((c) => ENCABEZADO_COLUMNA[c]),
    filas: conNombre.map(({ e, nombres, apellidos }) =>
      cols.map((c) => {
        switch (c) {
          case 'apellidos':
            return apellidos;
          case 'nombres':
            return nombres;
          case 'nombreCompleto':
            return e.nombre.trim();
          case 'correo':
            return e.correo ?? '';
          case 'nota':
            return e.nota;
          case 'desempeno':
            return e.desempeno ? ETIQUETA_DESEMPENO[e.desempeno] : '';
          case 'observacion':
            return e.observacion;
        }
      })
    ),
  };
}

function celdaCsv(v: string | number | null): string {
  if (v === null) return '';
  const s = typeof v === 'number' ? v.toFixed(1).replace('.', ',') : v;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con ; y coma decimal (la nota vacía queda vacía, no en cero). */
export function planillaCsv(p: Planilla): string {
  return [p.encabezados, ...p.filas].map((f) => f.map(celdaCsv).join(';')).join('\r\n') + '\r\n';
}
