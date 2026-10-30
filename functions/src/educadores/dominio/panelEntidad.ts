/**
 * Fase 6 — panel de la entidad, solo para sus admins. Cifras de grupo:
 * adopción por profesor, actividad por clase y dominio por grado o programa. El
 * detalle nominal de los estudiantes sigue siendo del profe de cada clase, y de
 * la comunicación solo se cuentan envíos (nunca textos ni correos). Puro.
 *
 * Un grupo (grado o programa) con menos de `MIN_GRUPO` estudiantes con datos no
 * muestra su dominio: en un grupo tan chico la cifra apunta a personas.
 */
import { DIA_MS } from './calendario';
import { DIAS_ACTIVO, META_ADOPCION } from './adopcion';
import {
  AMBITOS_MEN,
  COMPETENCIAS_MEN,
  alineacionDe,
  grupoGradoMen,
  type AlineacionMen,
  type AmbitoMen,
  type CompetenciaMen,
  type EjeMen,
  type GrupoGradoMen,
} from './normativa';
import { DESEMPENOS_MEN, desempenoMen, lograDesempeno } from './desempenosMen';
import { impactoDe, sumarImpactos, type Impacto, type SumasImpacto } from './pruebaEntradaSalida';

export const MIN_GRUPO = 5;
/** Un profe con clases y menos de este % de estudiantes activos sale en "bajo". */
export const ADOPCION_BAJA = 0.5;

export interface CompetenciaCurso {
  /** 0..1 */
  masteryPromedio: number;
  estudiantes: number;
}

export interface CursoPanel {
  id: string;
  nombre: string;
  grado: string;
  programa?: string | null;
  profesorUids: string[];
  archivada?: boolean;
  estudiantes: number;
  estudiantesActivos: number;
  ultimaActividad: number | null;
  /** Dominio por competencia de Ceti (del avance, en el periodo pedido). */
  porCompetencia: Record<string, CompetenciaCurso>;
  /** Lo mismo por ámbito conceptual y por competencia del MEN (estudiantes distintos). */
  porAmbitoMen?: Partial<Record<AmbitoMen, CompetenciaCurso>>;
  porCompetenciaMen?: Partial<Record<CompetenciaMen, CompetenciaCurso>>;
  /** Fase 7: por desempeño del MEN, estudiantes con datos suficientes y cuántos lo logran. */
  porDesempeno?: Record<string, ConteoDesempeno>;
  /** Fase 7: prueba de entrada y salida, en sumas (sin nombres). */
  impacto?: SumasImpacto;
  /** Anuncios y mensajes de los últimos 7 días (conteo). */
  comunicados7d: number;
  /** Estudiantes con resumen para acudientes activo (conteo). */
  familiasConResumen: number;
}

export interface ProfePanelEntrada {
  uid: string;
  nombre: string;
  rol: 'admin' | 'profe';
}

export type EstadoAdopcionProfe = 'activo' | 'bajo' | 'sinEmpezar';

export interface FilaProfe {
  uid: string;
  nombre: string;
  rol: 'admin' | 'profe';
  clases: number;
  estudiantes: number;
  estudiantesActivos: number;
  adopcion: number;
  ultimaActividad: number | null;
  estado: EstadoAdopcionProfe;
}

export interface FilaClase {
  id: string;
  nombre: string;
  grupo: string;
  profes: string[];
  estudiantes: number;
  estudiantesActivos: number;
  adopcion: number;
  ultimaActividad: number | null;
  sinProfe: boolean;
}

export interface FilaGrupo {
  /** 'g:10' (grado) o 'p:Contaduría' (programa). */
  clave: string;
  etiqueta: string;
  clases: number;
  estudiantes: number;
  estudiantesActivos: number;
  /** 0..1, null si el grupo es muy chico o no hay datos. */
  dominio: number | null;
  /** competencia → 0..1 (solo con datos y grupo suficiente). */
  competencias: Record<string, number>;
  masDebil: string | null;
}

export interface CeldaCobertura {
  estudiantes: number;
  /** 0..1, null si hay menos de MIN_GRUPO estudiantes con datos. */
  dominio: number | null;
}

export interface ConteoDesempeno {
  estudiantes: number;
  logran: number;
}

export interface FilaDesempeno {
  id: string;
  ambito: AmbitoMen;
  resumen: string;
  ref: string;
  estudiantes: number;
  logran: number;
  /** 0..1, null si hay menos de MIN_GRUPO estudiantes con datos. */
  logro: number | null;
}

export interface FilaCobertura {
  clave: string;
  etiqueta: string;
  /** Grupo de grados de las orientaciones (null en programas universitarios). */
  grupoMen: GrupoGradoMen | null;
  estudiantes: number;
  ambitos: Record<AmbitoMen, CeldaCobertura>;
  competencias: Record<CompetenciaMen, CeldaCobertura>;
  /** Ámbitos con al menos un estudiante con datos. */
  cubiertos: number;
  /**
   * Fase 7: desempeños del MEN del grupo de grados con datos (en programas
   * universitarios, todos los que tengan datos). Acumulado de la clase, no del
   * periodo: el resumen por desempeño no guarda fechas.
   */
  desempenos: FilaDesempeno[];
}

export interface PanelEntidad {
  resumen: {
    profes: number;
    profesActivos: number;
    clases: number;
    estudiantes: number;
    estudiantesActivos: number;
    adopcion: number;
    cumpleMeta: boolean;
    /** 0..1 promedio de todos los grupos con datos, ponderado por estudiantes. */
    dominio: number | null;
  };
  profes: FilaProfe[];
  clases: FilaClase[];
  grupos: FilaGrupo[];
  comunicacion: { comunicados7d: number; familiasConResumen: number; clasesQueEscriben: number };
  /** Cobertura de las orientaciones del MEN por grado o programa (Documento 26). */
  cobertura: FilaCobertura[];
  /** Ámbitos que la entidad ya trabaja en algún grado. */
  ambitosCubiertos: AmbitoMen[];
  /** Fase 7: impacto de la prueba de entrada y salida, de toda la entidad y por grado o programa. */
  impacto: { total: Impacto; grupos: (Impacto & { clave: string; etiqueta: string })[] };
  /** Periodo de los datos de dominio y cobertura (null = desde el principio). */
  periodo: { desde: number; hasta: number } | null;
  calculadoAt: number;
}

export interface ProgresoPanel {
  uid: string;
  /** El id del doc de avance (Fase 7: para los ámbitos de un mundo propio). */
  worldId?: string;
  competencia: string;
  mastery: number;
  updatedAt: number | null;
}

/**
 * Dominio por una clave (competencia de Ceti, ámbito o competencia del MEN) a
 * partir del avance de los estudiantes que siguen en la clase, en el rango
 * pedido. `estudiantes` cuenta personas distintas; el promedio es por registro
 * (un mundo = un registro), como el agregado por curso.
 */
export function dominioPor(
  progreso: readonly ProgresoPanel[],
  enLista: ReadonlySet<string>,
  claves: (p: ProgresoPanel) => readonly string[],
  rango?: { desde: number; hasta: number } | null
): Record<string, CompetenciaCurso> {
  const acc = new Map<string, { suma: number; n: number; uids: Set<string> }>();
  for (const p of progreso) {
    if (!enLista.has(p.uid)) continue;
    if (rango && (p.updatedAt === null || p.updatedAt < rango.desde || p.updatedAt > rango.hasta)) continue;
    const m = Math.min(1, Math.max(0, Number.isFinite(p.mastery) ? p.mastery : 0));
    for (const k of claves(p)) {
      const a = acc.get(k) ?? { suma: 0, n: 0, uids: new Set<string>() };
      a.suma += m;
      a.n += 1;
      a.uids.add(p.uid);
      acc.set(k, a);
    }
  }
  return Object.fromEntries(
    [...acc].map(([k, a]) => [k, { masteryPromedio: a.suma / a.n, estudiantes: a.uids.size }])
  );
}

/**
 * Competencias del MEN que se le suponen a un ámbito cuando el profe solo
 * eligió ámbitos para su mundo propio (lectura de Ceti, por eje).
 */
const COMPETENCIAS_POR_EJE: Record<EjeMen, readonly CompetenciaMen[]> = {
  economia: ['decidir'],
  finanzas: ['administrar', 'planear'],
  riesgo: ['gestionar'],
};

/**
 * Alineación de los mundos propios de una clase (Fase 7): los ámbitos que el
 * profe les puso (`ambitosMen` en config/mundos). Sin ámbitos, el mundo sigue
 * con la alineación de su competencia de Ceti.
 */
export function alineacionDeMundosPropios(
  mundos: readonly { worldId?: unknown; competencia?: unknown; ambitosMen?: unknown }[] | null | undefined
): Record<string, AlineacionMen> {
  const out: Record<string, AlineacionMen> = {};
  for (const m of mundos ?? []) {
    if (typeof m?.worldId !== 'string' || !Array.isArray(m.ambitosMen)) continue;
    const ambitos = AMBITOS_MEN.filter((a) => (m.ambitosMen as unknown[]).includes(a.id));
    if (ambitos.length === 0) continue;
    const base = typeof m.competencia === 'string' ? alineacionDe(m.competencia) : null;
    const competencias = base?.competencias.length
      ? base.competencias
      : COMPETENCIAS_MEN.filter((c) => ambitos.some((a) => COMPETENCIAS_POR_EJE[a.eje].includes(c)));
    out[m.worldId] = { ambitos: ambitos.map((a) => a.id), competencias };
  }
  return out;
}

/** Las tres vistas de dominio de un curso: competencia de Ceti, ámbito y competencia del MEN. */
export function dominiosDeCurso(
  progreso: readonly ProgresoPanel[],
  enLista: ReadonlySet<string>,
  rango?: { desde: number; hasta: number } | null,
  propios: Readonly<Record<string, AlineacionMen>> = {}
): Pick<CursoPanel, 'porCompetencia' | 'porAmbitoMen' | 'porCompetenciaMen'> {
  const alineacion = (p: ProgresoPanel) => (p.worldId && propios[p.worldId]) || alineacionDe(p.competencia);
  return {
    porCompetencia: dominioPor(progreso, enLista, (p) => [p.competencia], rango),
    porAmbitoMen: dominioPor(progreso, enLista, (p) => alineacion(p)?.ambitos ?? [], rango),
    porCompetenciaMen: dominioPor(progreso, enLista, (p) => alineacion(p)?.competencias ?? [], rango),
  };
}

/**
 * Por desempeño del MEN, cuántos estudiantes de la lista tienen datos
 * suficientes (ver lograDesempeno) y cuántos lo logran. Lee el resumen de clase
 * de cada estudiante (`porDesempeno`, Fase 7).
 */
export function desempenosDeCurso(
  resumenes: readonly { uid: string; porDesempeno?: Record<string, { respuestas: number; aciertos: number }> | null }[],
  enLista: ReadonlySet<string>
): Record<string, ConteoDesempeno> {
  const out: Record<string, ConteoDesempeno> = {};
  for (const r of resumenes) {
    if (!enLista.has(r.uid)) continue;
    for (const [id, c] of Object.entries(r.porDesempeno ?? {})) {
      if (!desempenoMen(id)) continue;
      const logra = lograDesempeno(c);
      if (logra === null) continue;
      const a = out[id] ?? { estudiantes: 0, logran: 0 };
      out[id] = { estudiantes: a.estudiantes + 1, logran: a.logran + (logra ? 1 : 0) };
    }
  }
  return out;
}

/** Las filas de desempeños de un grupo: los del grupo de grados (o todos si es un programa) con datos. */
export function filasDesempeno(
  cursos: readonly Pick<CursoPanel, 'porDesempeno'>[],
  grupoMen: GrupoGradoMen | null
): FilaDesempeno[] {
  const suma = new Map<string, ConteoDesempeno>();
  for (const c of cursos) {
    for (const [id, v] of Object.entries(c.porDesempeno ?? {})) {
      const a = suma.get(id) ?? { estudiantes: 0, logran: 0 };
      suma.set(id, { estudiantes: a.estudiantes + v.estudiantes, logran: a.logran + v.logran });
    }
  }
  return DESEMPENOS_MEN.filter((d) => (grupoMen ? d.grupo === grupoMen : true) && (suma.get(d.id)?.estudiantes ?? 0) > 0).map(
    (d) => {
      const v = suma.get(d.id)!;
      return {
        id: d.id,
        ambito: d.ambito,
        resumen: d.resumen,
        ref: d.ref,
        estudiantes: v.estudiantes,
        logran: v.logran,
        logro: v.estudiantes >= MIN_GRUPO ? v.logran / v.estudiantes : null,
      };
    }
  );
}

function sumarCeldas<K extends string>(
  cursos: readonly CursoPanel[],
  claves: readonly K[],
  de: (c: CursoPanel) => Partial<Record<K, CompetenciaCurso>> | undefined
): Record<K, CeldaCobertura> {
  const out = {} as Record<K, CeldaCobertura>;
  for (const k of claves) {
    let suma = 0;
    let n = 0;
    for (const c of cursos) {
      const v = de(c)?.[k];
      if (!v || !(v.estudiantes > 0)) continue;
      suma += v.masteryPromedio * v.estudiantes;
      n += v.estudiantes;
    }
    out[k] = { estudiantes: n, dominio: n >= MIN_GRUPO ? suma / n : null };
  }
  return out;
}

function proporcion(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function claveGrupo(c: Pick<CursoPanel, 'grado' | 'programa'>): { clave: string; etiqueta: string } {
  const programa = c.programa?.trim();
  if (programa) return { clave: `p:${programa}`, etiqueta: programa };
  return { clave: `g:${c.grado}`, etiqueta: `${c.grado}°` };
}

function maxNull(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

export function calcularPanelEntidad(
  cursosEntrada: readonly CursoPanel[],
  profesEntrada: readonly ProfePanelEntrada[],
  ahora: number,
  periodo: { desde: number; hasta: number } | null = null
): PanelEntidad {
  const cursos = cursosEntrada.filter((c) => c.archivada !== true);
  const nombres = new Map(profesEntrada.map((p) => [p.uid, p.nombre]));
  const desde = ahora - DIAS_ACTIVO * DIA_MS;

  const profes: FilaProfe[] = profesEntrada.map((p) => {
    const suyas = cursos.filter((c) => c.profesorUids.includes(p.uid));
    const estudiantes = suyas.reduce((s, c) => s + c.estudiantes, 0);
    const activos = suyas.reduce((s, c) => s + c.estudiantesActivos, 0);
    const ultima = suyas.reduce<number | null>((m, c) => maxNull(m, c.ultimaActividad), null);
    const adopcion = proporcion(activos, estudiantes);
    const estado: EstadoAdopcionProfe =
      suyas.length === 0 || estudiantes === 0 || ultima === null || ultima < desde
        ? 'sinEmpezar'
        : adopcion < ADOPCION_BAJA
          ? 'bajo'
          : 'activo';
    return {
      uid: p.uid,
      nombre: p.nombre,
      rol: p.rol,
      clases: suyas.length,
      estudiantes,
      estudiantesActivos: activos,
      adopcion,
      ultimaActividad: ultima,
      estado,
    };
  });
  const ordenEstado: Record<EstadoAdopcionProfe, number> = { activo: 0, bajo: 1, sinEmpezar: 2 };
  profes.sort((a, b) => ordenEstado[a.estado] - ordenEstado[b.estado] || b.adopcion - a.adopcion || a.nombre.localeCompare(b.nombre, 'es'));

  const clases: FilaClase[] = cursos
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      grupo: claveGrupo(c).etiqueta,
      profes: c.profesorUids.map((u) => nombres.get(u)).filter((n): n is string => !!n),
      estudiantes: c.estudiantes,
      estudiantesActivos: c.estudiantesActivos,
      adopcion: proporcion(c.estudiantesActivos, c.estudiantes),
      ultimaActividad: c.ultimaActividad,
      sinProfe: c.profesorUids.length === 0,
    }))
    .sort((a, b) => a.grupo.localeCompare(b.grupo, 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre, 'es'));

  const porGrupo = new Map<string, { etiqueta: string; cursos: CursoPanel[] }>();
  for (const c of cursos) {
    const { clave, etiqueta } = claveGrupo(c);
    const g = porGrupo.get(clave) ?? { etiqueta, cursos: [] };
    g.cursos.push(c);
    porGrupo.set(clave, g);
  }
  let sumaDominio = 0;
  let pesoDominio = 0;
  const grupos: FilaGrupo[] = [...porGrupo.entries()]
    .map(([clave, g]) => {
      const comp = new Map<string, { suma: number; n: number }>();
      for (const c of g.cursos) {
        for (const [id, v] of Object.entries(c.porCompetencia)) {
          if (!(v.estudiantes > 0)) continue;
          const a = comp.get(id) ?? { suma: 0, n: 0 };
          a.suma += v.masteryPromedio * v.estudiantes;
          a.n += v.estudiantes;
          comp.set(id, a);
        }
      }
      const competencias: Record<string, number> = {};
      let s = 0;
      let n = 0;
      for (const [id, a] of comp) {
        if (a.n < MIN_GRUPO) continue;
        competencias[id] = a.suma / a.n;
        s += a.suma;
        n += a.n;
      }
      const dominio = n > 0 ? s / n : null;
      if (dominio !== null) {
        sumaDominio += s;
        pesoDominio += n;
      }
      const debil = Object.entries(competencias).sort((a, b) => a[1] - b[1])[0];
      const estudiantes = g.cursos.reduce((t, c) => t + c.estudiantes, 0);
      return {
        clave,
        etiqueta: g.etiqueta,
        clases: g.cursos.length,
        estudiantes,
        estudiantesActivos: g.cursos.reduce((t, c) => t + c.estudiantesActivos, 0),
        dominio,
        competencias,
        masDebil: Object.keys(competencias).length > 1 && debil ? debil[0] : null,
      };
    })
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }));

  const idsAmbitos = AMBITOS_MEN.map((a) => a.id);
  const cobertura: FilaCobertura[] = [...porGrupo.entries()]
    .map(([clave, g]) => {
      const ambitos = sumarCeldas(g.cursos, idsAmbitos, (c) => c.porAmbitoMen);
      const grados = new Set(g.cursos.map((c) => grupoGradoMen(c.programa?.trim() ? null : c.grado)));
      const grupoMen = grados.size === 1 ? [...grados][0] : null;
      return {
        clave,
        etiqueta: g.etiqueta,
        grupoMen,
        desempenos: filasDesempeno(g.cursos, grupoMen),
        estudiantes: g.cursos.reduce((t, c) => t + c.estudiantes, 0),
        ambitos,
        competencias: sumarCeldas(g.cursos, COMPETENCIAS_MEN, (c) => c.porCompetenciaMen),
        cubiertos: idsAmbitos.filter((a) => ambitos[a].estudiantes > 0).length,
      };
    })
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }));
  const ambitosCubiertos = idsAmbitos.filter((a) => cobertura.some((f) => f.ambitos[a].estudiantes > 0));
  const impacto = {
    total: impactoDe(sumarImpactos(cursos.map((c) => c.impacto)), MIN_GRUPO),
    grupos: [...porGrupo.entries()]
      .map(([clave, g]) => ({ clave, etiqueta: g.etiqueta, ...impactoDe(sumarImpactos(g.cursos.map((c) => c.impacto)), MIN_GRUPO) }))
      .filter((f) => f.conEntrada > 0)
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true })),
  };

  const estudiantes = cursos.reduce((s, c) => s + c.estudiantes, 0);
  const estudiantesActivos = cursos.reduce((s, c) => s + c.estudiantesActivos, 0);
  const adopcion = proporcion(estudiantesActivos, estudiantes);
  return {
    resumen: {
      profes: profes.length,
      profesActivos: profes.filter((p) => p.estado !== 'sinEmpezar').length,
      clases: cursos.length,
      estudiantes,
      estudiantesActivos,
      adopcion,
      cumpleMeta: adopcion >= META_ADOPCION,
      dominio: pesoDominio > 0 ? sumaDominio / pesoDominio : null,
    },
    profes,
    clases,
    grupos,
    comunicacion: {
      comunicados7d: cursos.reduce((s, c) => s + c.comunicados7d, 0),
      familiasConResumen: cursos.reduce((s, c) => s + c.familiasConResumen, 0),
      clasesQueEscriben: cursos.filter((c) => c.comunicados7d > 0).length,
    },
    cobertura,
    ambitosCubiertos,
    impacto,
    periodo,
    calculadoAt: ahora,
  };
}
