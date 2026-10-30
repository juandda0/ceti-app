/**
 * Prueba de entrada y salida (Fase 7, función `prePostTest`, plan de entidad o
 * Nave). El profe abre la prueba de entrada al empezar y la de salida al
 * terminar; el estudiante la responde una sola vez por fase. Son las mismas
 * preguntas en las dos (las apartadas con `prueba: true` en los bancos por
 * defecto del grado, 2 por mundo), así que la diferencia mide lo que aprendió.
 *
 * - Config de la clase: `cursos/{k}/config/prueba` (la escribe el callable
 *   `gestionarPrueba`; la leen la clase y su profe).
 * - Resultado: `cursos/{k}/estudiantes/{uid}/impactTest/{pre|post}` (lo crea el
 *   estudiante una vez, con la fase abierta; lo lee su profe).
 * - Impacto: cifras de grupo para el panel de la entidad y el informe, con el
 *   mismo umbral `MIN_GRUPO` (un grupo con menos de 5 estudiantes con las dos
 *   pruebas no muestra promedios). Puro.
 */
import { AMBITOS_MEN, type AmbitoMen } from './normativa';

export const FASES_PRUEBA = ['pre', 'post'] as const;
export type FasePrueba = (typeof FASES_PRUEBA)[number];

export interface EstadoFase {
  abiertaAt: number;
  cerradaAt: number | null;
  abiertaPor: string;
}

export interface ConfigPrueba {
  pre?: EstadoFase | null;
  post?: EstadoFase | null;
}

export function esFasePrueba(v: unknown): v is FasePrueba {
  return v === 'pre' || v === 'post';
}

export function faseAbierta(config: ConfigPrueba | null | undefined, fase: FasePrueba): boolean {
  const f = config?.[fase];
  return !!f && typeof f.abiertaAt === 'number' && f.cerradaAt == null;
}

export type ErrorPrueba = 'salida_sin_entrada' | 'ya_abierta' | 'no_abierta';

export const MENSAJES_ERROR_PRUEBA: Record<ErrorPrueba, string> = {
  salida_sin_entrada: 'Primero abre la prueba de entrada.',
  ya_abierta: 'Esa prueba ya está abierta.',
  no_abierta: 'Esa prueba no está abierta.',
};

/** Siguiente config al abrir o cerrar una fase. La de salida necesita que la de entrada se haya abierto. */
export function cambiarFase(
  config: ConfigPrueba | null | undefined,
  fase: FasePrueba,
  abrir: boolean,
  uid: string,
  ahora: number
): { ok: true; config: ConfigPrueba } | { ok: false; error: ErrorPrueba } {
  const actual: ConfigPrueba = { pre: config?.pre ?? null, post: config?.post ?? null };
  if (abrir) {
    if (fase === 'post' && !actual.pre) return { ok: false, error: 'salida_sin_entrada' };
    if (faseAbierta(actual, fase)) return { ok: false, error: 'ya_abierta' };
    // Al abrir la salida se cierra la entrada: ya no tiene sentido responderla.
    const pre = fase === 'post' && faseAbierta(actual, 'pre') ? { ...actual.pre!, cerradaAt: ahora } : actual.pre;
    return { ok: true, config: { ...actual, pre, [fase]: { abiertaAt: ahora, cerradaAt: null, abiertaPor: uid } } };
  }
  if (!faseAbierta(actual, fase)) return { ok: false, error: 'no_abierta' };
  return { ok: true, config: { ...actual, [fase]: { ...actual[fase]!, cerradaAt: ahora } } };
}

export interface PreguntaPrueba {
  id: string;
  ambito?: string;
}

/**
 * Las preguntas de la prueba de una clase: las apartadas de cada mundo por
 * defecto, en el orden de los mundos y por id (las mismas en la entrada y la
 * salida). `porMundo` = worldId → preguntas con `prueba: true`.
 */
export function armarPrueba<T extends PreguntaPrueba>(
  mundos: readonly string[],
  porMundo: Readonly<Record<string, readonly T[]>>
): T[] {
  return mundos.flatMap((w) => [...(porMundo[w] ?? [])].sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true })));
}

export interface ResultadoPrueba {
  /** Aciertos. */
  score: number;
  total: number;
  takenAt: number;
  /** Aciertos por ámbito del MEN. */
  breakdown: Record<string, number>;
  /** Preguntas por ámbito del MEN. */
  totales: Record<string, number>;
}

/** El resultado que guarda el estudiante: aciertos totales y por ámbito. */
export function resultadoPrueba(
  respuestas: readonly { ambito?: string; ok: boolean }[],
  ahora: number
): ResultadoPrueba {
  const breakdown: Record<string, number> = {};
  const totales: Record<string, number> = {};
  for (const r of respuestas) {
    const a = AMBITOS_MEN.some((x) => x.id === r.ambito) ? (r.ambito as string) : 'otro';
    totales[a] = (totales[a] ?? 0) + 1;
    breakdown[a] = (breakdown[a] ?? 0) + (r.ok ? 1 : 0);
  }
  return { score: respuestas.filter((r) => r.ok).length, total: respuestas.length, takenAt: ahora, breakdown, totales };
}

/** Sumas de una clase, sin nombres: lo que viaja al panel de la entidad. */
export interface SumasImpacto {
  /** Estudiantes con entrada. */
  conEntrada: number;
  /** Estudiantes con las dos pruebas. */
  pares: number;
  /** Suma de los porcentajes (0..1) de los pares, en la entrada y en la salida. */
  sumaPre: number;
  sumaPost: number;
  /** Pares que subieron. */
  mejoran: number;
  /** Por ámbito, entre los pares: suma de porcentajes y pares con preguntas de ese ámbito. */
  porAmbito: Partial<Record<AmbitoMen, { sumaPre: number; sumaPost: number; n: number }>>;
}

export const SUMAS_VACIAS: SumasImpacto = { conEntrada: 0, pares: 0, sumaPre: 0, sumaPost: 0, mejoran: 0, porAmbito: {} };

const proporcion = (a: number, b: number) => (b > 0 ? a / b : 0);

function esResultado(r: unknown): r is ResultadoPrueba {
  const x = r as ResultadoPrueba | null;
  return !!x && typeof x.score === 'number' && typeof x.total === 'number' && x.total > 0;
}

export function sumasImpacto(
  resultados: readonly { uid: string; pre?: unknown; post?: unknown }[],
  enLista: ReadonlySet<string>
): SumasImpacto {
  const s: SumasImpacto = { ...SUMAS_VACIAS, porAmbito: {} };
  for (const r of resultados) {
    if (!enLista.has(r.uid) || !esResultado(r.pre)) continue;
    s.conEntrada += 1;
    if (!esResultado(r.post)) continue;
    const pre = proporcion(r.pre.score, r.pre.total);
    const post = proporcion(r.post.score, r.post.total);
    s.pares += 1;
    s.sumaPre += pre;
    s.sumaPost += post;
    if (post > pre) s.mejoran += 1;
    for (const a of AMBITOS_MEN) {
      const tPre = r.pre.totales?.[a.id] ?? 0;
      const tPost = r.post.totales?.[a.id] ?? 0;
      if (!tPre || !tPost) continue;
      const v = s.porAmbito[a.id] ?? { sumaPre: 0, sumaPost: 0, n: 0 };
      s.porAmbito[a.id] = {
        sumaPre: v.sumaPre + proporcion(r.pre.breakdown?.[a.id] ?? 0, tPre),
        sumaPost: v.sumaPost + proporcion(r.post.breakdown?.[a.id] ?? 0, tPost),
        n: v.n + 1,
      };
    }
  }
  return s;
}

export function sumarImpactos(lista: readonly (SumasImpacto | null | undefined)[]): SumasImpacto {
  const s: SumasImpacto = { ...SUMAS_VACIAS, porAmbito: {} };
  for (const x of lista) {
    if (!x) continue;
    s.conEntrada += x.conEntrada;
    s.pares += x.pares;
    s.sumaPre += x.sumaPre;
    s.sumaPost += x.sumaPost;
    s.mejoran += x.mejoran;
    for (const [k, v] of Object.entries(x.porAmbito)) {
      const a = s.porAmbito[k as AmbitoMen] ?? { sumaPre: 0, sumaPost: 0, n: 0 };
      s.porAmbito[k as AmbitoMen] = { sumaPre: a.sumaPre + v.sumaPre, sumaPost: a.sumaPost + v.sumaPost, n: a.n + v.n };
    }
  }
  return s;
}

export interface Impacto {
  conEntrada: number;
  pares: number;
  /** 0..1; null si hay menos de `minimo` pares. */
  pre: number | null;
  post: number | null;
  /** Puntos de diferencia (post - pre), 0..1. */
  cambio: number | null;
  /** Proporción de pares que subieron. */
  mejoran: number | null;
  porAmbito: { ambito: AmbitoMen; n: number; pre: number | null; post: number | null }[];
}

/** Promedios a partir de las sumas; con menos de `minimo` pares solo se dan los conteos. */
export function impactoDe(s: SumasImpacto, minimo: number): Impacto {
  const ok = s.pares >= minimo;
  return {
    conEntrada: s.conEntrada,
    pares: s.pares,
    pre: ok ? s.sumaPre / s.pares : null,
    post: ok ? s.sumaPost / s.pares : null,
    cambio: ok ? (s.sumaPost - s.sumaPre) / s.pares : null,
    mejoran: ok ? s.mejoran / s.pares : null,
    porAmbito: AMBITOS_MEN.filter((a) => (s.porAmbito[a.id]?.n ?? 0) > 0).map((a) => {
      const v = s.porAmbito[a.id]!;
      const okA = v.n >= minimo;
      return { ambito: a.id, n: v.n, pre: okA ? v.sumaPre / v.n : null, post: okA ? v.sumaPost / v.n : null };
    }),
  };
}
