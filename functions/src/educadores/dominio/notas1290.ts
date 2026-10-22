/**
 * Notas por periodo en la escala del Decreto 1290 de 2009 (art. 5): Desempeño
 * Superior, Alto, Básico y Bajo. Cada colegio fija en su SIEE la escala numérica
 * equivalente; por defecto se usa la más común (1,0 a 5,0). Puro.
 *
 * Es "Ceti hace el papeleo": el profe exporta la nota, el desempeño y una
 * observación por estudiante, lista para la plataforma del colegio.
 */

export const DESEMPENOS = ['bajo', 'basico', 'alto', 'superior'] as const;
export type Desempeno = (typeof DESEMPENOS)[number];

export interface RangoDesempeno {
  desempeno: Desempeno;
  /** Nota mínima del rango, inclusive. */
  min: number;
}

export interface EscalaSiee {
  notaMin: number;
  notaMax: number;
  /** Ordenados de menor a mayor. */
  rangos: RangoDesempeno[];
}

export const ESCALA_POR_DEFECTO: EscalaSiee = {
  notaMin: 1,
  notaMax: 5,
  rangos: [
    { desempeno: 'bajo', min: 1 },
    { desempeno: 'basico', min: 3 },
    { desempeno: 'alto', min: 4 },
    { desempeno: 'superior', min: 4.6 },
  ],
};

export const ETIQUETA_DESEMPENO: Record<Desempeno, string> = {
  bajo: 'Bajo',
  basico: 'Básico',
  alto: 'Alto',
  superior: 'Superior',
};

function redondear1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Maestría 0..1 → nota de la escala, con un decimal. */
export function notaDesdeMaestria(maestria: number, escala: EscalaSiee = ESCALA_POR_DEFECTO): number {
  const m = Math.min(1, Math.max(0, maestria));
  return redondear1(escala.notaMin + (escala.notaMax - escala.notaMin) * m);
}

export function desempenoDeNota(nota: number, escala: EscalaSiee = ESCALA_POR_DEFECTO): Desempeno {
  let actual: Desempeno = escala.rangos[0]?.desempeno ?? 'bajo';
  for (const r of escala.rangos) {
    if (nota + 1e-9 >= r.min) actual = r.desempeno;
  }
  return actual;
}

export interface EntradaNota {
  nombre: string;
  /** competenciaId → maestría 0..1 (solo las que tienen datos). */
  maestriaPorCompetencia: Record<string, number>;
  mundosCompletados: number;
}

export interface FilaNota {
  nombre: string;
  /** null = sin evaluar (no hay datos en el periodo). */
  nota: number | null;
  desempeno: Desempeno | null;
  mundosCompletados: number;
  notasPorCompetencia: Record<string, number>;
  observacion: string;
}

export interface OpcionesNotas {
  escala?: EscalaSiee;
  /** competenciaId → nombre visible. */
  etiquetaCompetencia: (id: string) => string;
}

function promedio(valores: number[]): number {
  return valores.length === 0 ? 0 : valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Observación de una línea para el boletín, desde la competencia más fuerte y la más débil. */
export function observacion(
  e: EntradaNota,
  nota: number | null,
  etiqueta: (id: string) => string,
  escala: EscalaSiee = ESCALA_POR_DEFECTO
): string {
  const pares = Object.entries(e.maestriaPorCompetencia);
  if (nota === null || pares.length === 0) {
    return 'Sin actividad registrada en Ceti durante el periodo.';
  }
  const ordenadas = [...pares].sort((a, b) => b[1] - a[1]);
  const fuerte = etiqueta(ordenadas[0][0]);
  const debil = etiqueta(ordenadas[ordenadas.length - 1][0]);
  const d = desempenoDeNota(nota, escala);
  if (ordenadas.length === 1) {
    return `Desempeño ${ETIQUETA_DESEMPENO[d].toLowerCase()} en ${fuerte}.`;
  }
  if (d === 'bajo' || d === 'basico') {
    return `Avanza en ${fuerte}; necesita refuerzo en ${debil}.`;
  }
  return `Se destaca en ${fuerte}; puede seguir fortaleciendo ${debil}.`;
}

/** Notas del periodo para un curso, en el orden recibido. */
export function construirNotas(entradas: EntradaNota[], opciones: OpcionesNotas): FilaNota[] {
  const escala = opciones.escala ?? ESCALA_POR_DEFECTO;
  return entradas.map((e) => {
    const valores = Object.values(e.maestriaPorCompetencia);
    const nota = valores.length === 0 ? null : notaDesdeMaestria(promedio(valores), escala);
    const notasPorCompetencia = Object.fromEntries(
      Object.entries(e.maestriaPorCompetencia).map(([k, v]) => [k, notaDesdeMaestria(v, escala)])
    );
    return {
      nombre: e.nombre,
      nota,
      desempeno: nota === null ? null : desempenoDeNota(nota, escala),
      mundosCompletados: e.mundosCompletados,
      notasPorCompetencia,
      observacion: observacion(e, nota, opciones.etiquetaCompetencia, escala),
    };
  });
}

function celda(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Coma decimal para Excel en español. */
function decimal(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

/**
 * CSV separado por punto y coma (Excel en español abre bien el ; y la coma
 * decimal). Columnas: estudiante, nota, desempeño, mundos, una por competencia,
 * observación.
 */
export function notasCsv(filas: FilaNota[], competencias: { id: string; etiqueta: string }[], periodo: number): string {
  const encabezado = [
    'Estudiante',
    `Nota periodo ${periodo}`,
    'Desempeño',
    'Mundos completados',
    ...competencias.map((c) => c.etiqueta),
    'Observación',
  ];
  const lineas = filas.map((f) =>
    [
      f.nombre,
      f.nota === null ? 'Sin evaluar' : decimal(f.nota),
      f.desempeno === null ? '' : ETIQUETA_DESEMPENO[f.desempeno],
      String(f.mundosCompletados),
      ...competencias.map((c) => {
        const n = f.notasPorCompetencia[c.id];
        return n === undefined ? '' : decimal(n);
      }),
      f.observacion,
    ]
      .map(celda)
      .join(';')
  );
  return [encabezado.map(celda).join(';'), ...lineas].join('\n');
}
