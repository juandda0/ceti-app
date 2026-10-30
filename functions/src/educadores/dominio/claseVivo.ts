/**
 * Fase 8 — clase en vivo. El profe proyecta una pregunta a la vez y los
 * estudiantes activos de la clase responden desde su celular; al revelar, el
 * servidor puntúa (acertar + rapidez) y al terminar deja un intento por
 * estudiante con `tipo: 'vivo'` y el desempeño `d` de cada respuesta, para que
 * sume en `resumen/clase`, la ficha, el Análisis y el panel de la entidad.
 *
 * - `cursos/{k}/vivo/actual`: lo que ven todos (sin la respuesta correcta).
 * - `cursos/{k}/vivo/actual/privado/clave`: las preguntas con su respuesta y el
 *   registro de cada estudiante (solo el servidor).
 * - `cursos/{k}/vivo/actual/respuestas/{n}_{uid}` y `presentes/{uid}`: los
 *   escribe el estudiante (las reglas exigen la pregunta abierta).
 *
 * Solo opción múltiple y verdadero/falso, y nunca las preguntas apartadas para
 * la prueba de entrada y salida. Puro: sin Firebase.
 */

import { erradaAEsconder } from './adaptaciones';
import type { Grupo } from './grupos';

export const SEGUNDOS_VIVO = [10, 20, 30] as const;
export const MIN_PREGUNTAS_VIVO = 3;
export const MAX_PREGUNTAS_VIVO = 15;
export const MAX_OPCIONES_VIVO = 6;
/** Adaptación «más tiempo» (Fase 8c): 50 % más en cada pregunta. */
export const FACTOR_MAS_TIEMPO = 1.5;
/** Margen para la latencia de la red antes de dar una respuesta por tardía. */
export const GRACIA_MS = 1500;
export const PUNTOS_BASE = 500;
export const PUNTOS_RAPIDEZ = 500;

export type TipoPreguntaVivo = 'multiple_choice' | 'true_false';
export type EstadoVivo = 'lobby' | 'pregunta' | 'revelada' | 'terminada';

export interface PreguntaVivo {
  id: string;
  tipo: TipoPreguntaVivo;
  enunciado: string;
  opciones: string[];
  /** Índice de la opción correcta (en V/F: 0 = verdadero). */
  correcta: number;
  /** Desempeño del MEN, si la pregunta lo trae (Fase 7). */
  d?: string;
  explicacion?: string;
}

/** Lo que se registra de cada respuesta, con la forma de `RespuestaIntento`. */
export interface RespuestaVivo {
  p: string;
  t: TipoPreguntaVivo;
  ok: boolean;
  /** Como en las lecciones: índice en opción múltiple, 'true'/'false' en V/F. */
  r: string;
  ms: number;
  d?: string;
}

export interface PuntajeVivo {
  nombre: string;
  puntos: number;
  aciertos: number;
  respondidas: number;
  /** Puntos de la última pregunta revelada (null si no respondió). */
  ultimo: number | null;
}

export interface PreguntaPublica {
  n: number;
  tipo: TipoPreguntaVivo;
  enunciado: string;
  opciones: string[];
  /** Una opción errada que la adaptación «menos opciones» esconde. */
  sinUna: number | null;
  segundos: number;
  abiertaAt: number;
}

export interface Revelada {
  n: number;
  correcta: number;
  conteo: number[];
  respondieron: number;
  aciertos: number;
  explicacion: string | null;
}

export interface GrupoVivo {
  id: string;
  nombre: string;
  color: string;
  puntos: number;
  miembros: number;
}

export interface SesionVivo {
  id: string;
  estado: EstadoVivo;
  worldId: string;
  titulo: string;
  total: number;
  /** Pregunta en curso o la última revelada (-1 en el lobby). */
  actual: number;
  segundos: number;
  pregunta: PreguntaPublica | null;
  revelada: Revelada | null;
  puntajes: Record<string, PuntajeVivo>;
  grupos: GrupoVivo[];
  creadoPor: string;
  creadoAt: number;
  actualizadoAt: number;
  terminadaAt: number | null;
}

export interface ClaveVivo {
  preguntas: PreguntaVivo[];
  registro: Record<string, RespuestaVivo[]>;
}

/** Una respuesta tal como la deja el estudiante, con el tiempo que midió el servidor. */
export interface RespuestaLlegada {
  uid: string;
  r: number;
  ms: number;
}

/** Un grupo de la clase (dominio/grupos.ts). */
export type GrupoClase = Grupo;

export type ErrorVivo =
  | 'sin_preguntas'
  | 'muy_pocas'
  | 'estado_invalido'
  | 'sin_mas_preguntas'
  | 'segundos_invalidos';

export const MENSAJES_ERROR_VIVO: Record<ErrorVivo, string> = {
  sin_preguntas: 'Este mundo no tiene preguntas de opción múltiple o verdadero/falso para la clase en vivo.',
  muy_pocas: `La clase en vivo necesita al menos ${MIN_PREGUNTAS_VIVO} preguntas.`,
  estado_invalido: 'La clase en vivo ya cambió. Vuelve a intentarlo.',
  sin_mas_preguntas: 'Ya no quedan preguntas: termina la clase en vivo.',
  segundos_invalidos: 'El tiempo por pregunta debe ser 10, 20 o 30 segundos.',
};

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Limpia las preguntas que manda el profe (las arma su app desde el banco de la
 * clase). Descarta las de prueba, las mal formadas y las repetidas; corta en 15.
 */
export function validarPreguntasVivo(raw: unknown): PreguntaVivo[] {
  if (!Array.isArray(raw)) return [];
  const vistas = new Set<string>();
  const out: PreguntaVivo[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const q = it as Record<string, unknown>;
    if (q.prueba === true) continue;
    const id = texto(q.id, 120);
    const enunciado = texto(q.enunciado, 400);
    if (!id || !enunciado || vistas.has(id)) continue;
    let pregunta: PreguntaVivo | null = null;
    if (q.tipo === 'true_false') {
      const correcta = q.correcta === 0 || q.correcta === 1 ? q.correcta : null;
      if (correcta !== null) pregunta = { id, tipo: 'true_false', enunciado, opciones: ['Verdadero', 'Falso'], correcta };
    } else if (q.tipo === 'multiple_choice' && Array.isArray(q.opciones)) {
      const opciones = q.opciones.map((o) => texto(o, 160));
      const correcta = Number(q.correcta);
      if (
        opciones.length >= 2 &&
        opciones.length <= MAX_OPCIONES_VIVO &&
        opciones.every(Boolean) &&
        Number.isInteger(correcta) &&
        correcta >= 0 &&
        correcta < opciones.length
      ) {
        pregunta = { id, tipo: 'multiple_choice', enunciado, opciones, correcta };
      }
    }
    if (!pregunta) continue;
    const d = texto(q.d, 20);
    const explicacion = texto(q.explicacion, 400);
    if (d) pregunta.d = d;
    if (explicacion) pregunta.explicacion = explicacion;
    vistas.add(id);
    out.push(pregunta);
    if (out.length >= MAX_PREGUNTAS_VIVO) break;
  }
  return out;
}

/** Un ítem del banco tal como lo trae la app (MultipleChoiceItem / TrueFalseItem). */
export interface ItemBancoVivo {
  id: string;
  tipo: string;
  enunciado: string;
  opciones?: string[];
  correctIndex?: number;
  respuesta?: boolean | number;
  explicacion?: string;
  desempeno?: string;
  prueba?: boolean;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function barajar<T>(arr: readonly T[], semilla: number): T[] {
  const a = [...arr];
  let s = semilla || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Elige `cantidad` preguntas del banco de un mundo para la clase en vivo, con
 * opción múltiple y V/F intercalados (2 a 1) y sin las de la prueba. Lo usa la
 * app del profe antes de abrir la sesión.
 */
export function elegirPreguntasVivo(items: readonly ItemBancoVivo[], cantidad: number, semilla: string): PreguntaVivo[] {
  const aptas = items.filter((i) => i.prueba !== true);
  const mc = barajar(aptas.filter((i) => i.tipo === 'multiple_choice'), hash(`${semilla}:mc`));
  const vf = barajar(aptas.filter((i) => i.tipo === 'true_false'), hash(`${semilla}:vf`));
  const orden: ItemBancoVivo[] = [];
  while (orden.length < cantidad && (mc.length || vf.length)) {
    const tocaVf = orden.length % 3 === 2;
    const sig = (tocaVf ? vf.shift() : mc.shift()) ?? mc.shift() ?? vf.shift();
    if (sig) orden.push(sig);
  }
  return validarPreguntasVivo(
    orden.map((i) =>
      i.tipo === 'true_false'
        ? { id: i.id, tipo: 'true_false', enunciado: i.enunciado, correcta: i.respuesta === true || i.respuesta === 1 ? 0 : 1, d: i.desempeno, explicacion: i.explicacion }
        : { id: i.id, tipo: 'multiple_choice', enunciado: i.enunciado, opciones: i.opciones, correcta: i.correctIndex, d: i.desempeno, explicacion: i.explicacion }
    )
  );
}

/** La opción errada que se esconde con «menos opciones» (solo con 4 o más). */
export function opcionAEsconder(p: PreguntaVivo): number | null {
  return p.tipo === 'multiple_choice' ? erradaAEsconder(p.id, p.opciones.length, p.correcta) : null;
}

/** «Mariana López» → «Mariana L.». */
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Estudiante';
  if (partes.length === 1) return partes[0].slice(0, 24);
  return `${partes[0].slice(0, 20)} ${partes[1][0].toUpperCase()}.`;
}

export function limiteMs(segundos: number, factor = 1): number {
  return Math.round(segundos * 1000 * factor);
}

/** Puntos de una respuesta: 500 por acertar y hasta 500 más por rapidez. */
export function puntosDe(ok: boolean, ms: number, limite: number): number {
  if (!ok) return 0;
  const fraccion = 1 - Math.min(Math.max(ms, 0), limite) / limite;
  return Math.round(PUNTOS_BASE + PUNTOS_RAPIDEZ * fraccion);
}

export function crearSesion(params: {
  id: string;
  worldId: string;
  titulo: string;
  preguntas: readonly PreguntaVivo[];
  segundos: number;
  uid: string;
  ahora: number;
}): { ok: true; sesion: SesionVivo; clave: ClaveVivo } | { ok: false; error: ErrorVivo } {
  if (!(SEGUNDOS_VIVO as readonly number[]).includes(params.segundos)) return { ok: false, error: 'segundos_invalidos' };
  if (params.preguntas.length === 0) return { ok: false, error: 'sin_preguntas' };
  if (params.preguntas.length < MIN_PREGUNTAS_VIVO) return { ok: false, error: 'muy_pocas' };
  return {
    ok: true,
    sesion: {
      id: params.id,
      estado: 'lobby',
      worldId: params.worldId,
      titulo: params.titulo.slice(0, 80),
      total: params.preguntas.length,
      actual: -1,
      segundos: params.segundos,
      pregunta: null,
      revelada: null,
      puntajes: {},
      grupos: [],
      creadoPor: params.uid,
      creadoAt: params.ahora,
      actualizadoAt: params.ahora,
      terminadaAt: null,
    },
    clave: { preguntas: [...params.preguntas], registro: {} },
  };
}

/** Abre la pregunta siguiente (desde el lobby o tras revelar). */
export function abrirSiguiente(
  sesion: SesionVivo,
  clave: ClaveVivo,
  ahora: number
): { ok: true; sesion: SesionVivo } | { ok: false; error: ErrorVivo } {
  if (sesion.estado !== 'lobby' && sesion.estado !== 'revelada') return { ok: false, error: 'estado_invalido' };
  const n = sesion.actual + 1;
  const p = clave.preguntas[n];
  if (!p) return { ok: false, error: 'sin_mas_preguntas' };
  return {
    ok: true,
    sesion: {
      ...sesion,
      estado: 'pregunta',
      actual: n,
      pregunta: {
        n,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: [...p.opciones],
        sinUna: opcionAEsconder(p),
        segundos: sesion.segundos,
        abiertaAt: ahora,
      },
      actualizadoAt: ahora,
    },
  };
}

/** Puntaje por grupo: el promedio de los miembros que participaron. */
export function rankingGrupos(puntajes: Record<string, PuntajeVivo>, grupos: readonly GrupoClase[]): GrupoVivo[] {
  return grupos
    .map((g) => {
      const miembros = g.uids.filter((u) => puntajes[u]);
      const total = miembros.reduce((s, u) => s + puntajes[u].puntos, 0);
      return {
        id: g.id,
        nombre: g.nombre,
        color: g.color,
        puntos: miembros.length ? Math.round(total / miembros.length) : 0,
        miembros: miembros.length,
      };
    })
    .filter((g) => g.miembros > 0)
    .sort((a, b) => b.puntos - a.puntos);
}

/**
 * Cierra la pregunta abierta: cuenta las opciones, suma puntos y guarda cada
 * respuesta en el registro privado. `factores` = 1.5 para quien tiene «más
 * tiempo»; una respuesta que llega después de su límite no cuenta.
 */
export function revelarPregunta(params: {
  sesion: SesionVivo;
  clave: ClaveVivo;
  respuestas: readonly RespuestaLlegada[];
  nombres: Record<string, string>;
  factores: Record<string, number>;
  grupos: readonly GrupoClase[];
  ahora: number;
}): { ok: true; sesion: SesionVivo; clave: ClaveVivo } | { ok: false; error: ErrorVivo } {
  const { sesion, clave } = params;
  if (sesion.estado !== 'pregunta' || !sesion.pregunta) return { ok: false, error: 'estado_invalido' };
  const n = sesion.pregunta.n;
  const p = clave.preguntas[n];
  if (!p) return { ok: false, error: 'estado_invalido' };
  const conteo = p.opciones.map(() => 0);
  const puntajes: Record<string, PuntajeVivo> = Object.fromEntries(
    Object.entries(sesion.puntajes).map(([u, v]) => [u, { ...v, ultimo: null }])
  );
  const registro = { ...clave.registro };
  const yaRespondio = new Set<string>();
  let aciertos = 0;
  for (const r of params.respuestas) {
    if (!params.nombres[r.uid] || yaRespondio.has(r.uid)) continue;
    if (!Number.isInteger(r.r) || r.r < 0 || r.r >= p.opciones.length) continue;
    const limite = limiteMs(sesion.segundos, params.factores[r.uid] ?? 1);
    if (r.ms > limite + GRACIA_MS) continue;
    yaRespondio.add(r.uid);
    const ok = r.r === p.correcta;
    const pts = puntosDe(ok, r.ms, limite);
    conteo[r.r]++;
    if (ok) aciertos++;
    const previo = puntajes[r.uid] ?? {
      nombre: nombreCorto(params.nombres[r.uid]),
      puntos: 0,
      aciertos: 0,
      respondidas: 0,
      ultimo: null,
    };
    puntajes[r.uid] = {
      ...previo,
      puntos: previo.puntos + pts,
      aciertos: previo.aciertos + (ok ? 1 : 0),
      respondidas: previo.respondidas + 1,
      ultimo: pts,
    };
    registro[r.uid] = [
      ...(registro[r.uid] ?? []),
      {
        p: p.id,
        t: p.tipo,
        ok,
        r: p.tipo === 'true_false' ? String(r.r === 0) : String(r.r),
        ms: Math.max(0, Math.round(r.ms)),
        ...(p.d ? { d: p.d } : {}),
      },
    ];
  }
  return {
    ok: true,
    sesion: {
      ...sesion,
      estado: 'revelada',
      revelada: {
        n,
        correcta: p.correcta,
        conteo,
        respondieron: yaRespondio.size,
        aciertos,
        explicacion: p.explicacion ?? null,
      },
      puntajes,
      grupos: rankingGrupos(puntajes, params.grupos),
      actualizadoAt: params.ahora,
    },
    clave: { ...clave, registro },
  };
}

export function terminarSesion(sesion: SesionVivo, ahora: number): SesionVivo {
  return { ...sesion, estado: 'terminada', pregunta: null, actualizadoAt: ahora, terminadaAt: ahora };
}

/** Los puestos de mayor a menor puntaje (empate: más aciertos, luego nombre). */
export function rankingVivo(puntajes: Record<string, PuntajeVivo>): (PuntajeVivo & { uid: string; puesto: number })[] {
  return Object.entries(puntajes)
    .map(([uid, v]) => ({ uid, ...v }))
    .sort((a, b) => b.puntos - a.puntos || b.aciertos - a.aciertos || a.nombre.localeCompare(b.nombre))
    .map((v, i) => ({ ...v, puesto: i + 1 }));
}

/**
 * El intento que queda en el registro de cada estudiante al terminar. Mismo
 * formato que una lección (≤ 40 respuestas) con `tipo: 'vivo'`.
 */
export function intentosDeSesion(
  sesion: Pick<SesionVivo, 'worldId' | 'creadoAt'>,
  clave: ClaveVivo,
  finAt: number
): Record<string, {
  worldId: string;
  tipo: 'vivo';
  nivel: null;
  resultado: 'completado';
  inicioAt: number;
  finAt: number;
  duracionMs: number;
  total: number;
  aciertos: number;
  respuestas: RespuestaVivo[];
  uid: string;
}> {
  const out: ReturnType<typeof intentosDeSesion> = {};
  for (const [uid, rs] of Object.entries(clave.registro)) {
    if (!rs.length) continue;
    const respuestas = rs.slice(0, 40);
    out[uid] = {
      worldId: sesion.worldId,
      tipo: 'vivo',
      nivel: null,
      resultado: 'completado',
      inicioAt: sesion.creadoAt,
      finAt,
      duracionMs: Math.min(2 * 60 * 60 * 1000, Math.max(0, finAt - sesion.creadoAt)),
      total: respuestas.length,
      aciertos: respuestas.filter((r) => r.ok).length,
      respuestas,
      uid,
    };
  }
  return out;
}

/** Lo que queda de una sesión en el historial de la clase: solo cifras de grupo. */
export function resumenSesion(sesion: SesionVivo, clave: ClaveVivo) {
  const participantes = Object.keys(sesion.puntajes).length;
  const porPregunta = clave.preguntas.map((p) => {
    let vistas = 0;
    let ok = 0;
    for (const rs of Object.values(clave.registro)) {
      const r = rs.find((x) => x.p === p.id);
      if (r) {
        vistas++;
        if (r.ok) ok++;
      }
    }
    return { id: p.id, respondieron: vistas, aciertos: ok };
  });
  const respondidas = porPregunta.reduce((s, p) => s + p.respondieron, 0);
  const aciertos = porPregunta.reduce((s, p) => s + p.aciertos, 0);
  return {
    worldId: sesion.worldId,
    titulo: sesion.titulo,
    preguntas: sesion.total,
    participantes,
    pctAciertos: respondidas ? Math.round((aciertos / respondidas) * 100) : null,
    porPregunta,
    creadoAt: sesion.creadoAt,
    terminadaAt: sesion.terminadaAt,
    creadoPor: sesion.creadoPor,
  };
}
