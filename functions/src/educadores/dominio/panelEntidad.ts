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
  /** `agregados/resumen.porCompetencia` del curso. */
  porCompetencia: Record<string, CompetenciaCurso>;
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
  calculadoAt: number;
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
  ahora: number
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
    calculadoAt: ahora,
  };
}
