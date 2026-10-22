/**
 * "Exportar mis datos" del profe (t6 de los términos: tus datos se exportan
 * cuando quieras). Un JSON con sus clases, la configuración de mundos y el
 * contenido que escribió él (piezas personalizadas y mundos propios `cw_*`).
 *
 * Nunca lleva datos de estudiantes: ni roster ni progreso. `armarExportacion`
 * copia campo por campo (no esparce los documentos), así un campo nuevo en
 * Firestore no se cuela al archivo sin que alguien lo decida aquí.
 *
 * Los repositorios se llaman por su objeto (`rosterRepository.metodo(...)`)
 * para que la demo /dev/profe los pueda reemplazar.
 */
import { Platform } from 'react-native';
import { fechaBogota, type PlanId } from '@/functions/src/educadores/dominio';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import { downloadTextFile } from '@shared/lib/export/downloadFile';
import type { BancoDoc } from '@features/learning/data/quiz.types';
import type { MicroteoriaBank } from '@features/learning/data/content.types';
import type { CursoConfigMundos } from '@shared/types/tenancy';

export const FORMATO_EXPORTACION = 'ceti-profe-v1';

/** Piezas que un profe puede reescribir en un mundo (las que se exportan). */
const PIEZAS_QUIZ = ['mc', 'vf', 'ordenar'] as const;
type PiezaQuiz = (typeof PIEZAS_QUIZ)[number];

export interface ContenidoMundo {
  mc?: BancoDoc | null;
  vf?: BancoDoc | null;
  ordenar?: BancoDoc | null;
  teoria?: MicroteoriaBank | null;
}

export interface ClaseEntrada {
  curso: CursoWithId;
  config: CursoConfigMundos | null;
  /** Solo las piezas personalizadas (source 'custom'), por worldId. */
  contenido: Record<string, ContenidoMundo>;
}

export interface EntradaExportacion {
  ahora: number;
  profe: { uid: string; nombre: string | null; correo: string | null };
  colegio: { id: string; nombre: string | null };
  plan: PlanId;
  clases: ClaseEntrada[];
}

export interface MundoPropioExportado {
  worldId: string;
  activo: boolean;
  nombre?: string;
  descripcion?: string;
  subtitle?: string;
  competencia?: string;
}

export interface ClaseExportada {
  id: string;
  nombre: string;
  grado: string;
  codigo: string | null;
  creadaAt: number | null;
  config: CursoConfigMundos | null;
  mundosPropios: MundoPropioExportado[];
  contenidoPropio: Record<
    string,
    {
      mc?: { items: unknown[] };
      vf?: { items: unknown[] };
      ordenar?: { items: unknown[] };
      teoria?: { cards: unknown[] };
    }
  >;
}

export interface Exportacion {
  formato: typeof FORMATO_EXPORTACION;
  generadoAt: string;
  profe: { uid: string; nombre: string | null; correo: string | null };
  colegio: { id: string; nombre: string | null };
  plan: PlanId;
  clases: ClaseExportada[];
}

/** Copia profunda sin `undefined` (en objetos se quita la clave; en listas, el elemento). */
export function sinUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.filter((v) => v !== undefined).map((v) => sinUndefined(v)) as unknown as T;
  }
  if (valor && typeof valor === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v !== undefined) out[k] = sinUndefined(v);
    }
    return out as T;
  }
  return valor;
}

/** Solo los campos de la configuración de mundos (nada más del documento). */
function configLimpia(config: CursoConfigMundos | null): CursoConfigMundos | null {
  if (!config) return null;
  return {
    mundos: (config.mundos ?? []).map((m) => ({
      worldId: m.worldId,
      activo: m.activo,
      nombre: m.nombre,
      subtitle: m.subtitle,
      descripcion: m.descripcion,
      competencia: m.competencia,
    })),
    overrides: config.overrides
      ? Object.fromEntries(
          Object.entries(config.overrides).map(([worldId, o]) => [
            worldId,
            {
              mc: o?.mc,
              vf: o?.vf,
              ordenar: o?.ordenar,
              teoria: o?.teoria,
              eligeCamino: o?.eligeCamino,
            },
          ])
        )
      : undefined,
    version: config.version,
    updatedAt: config.updatedAt,
    updatedByUid: config.updatedByUid,
  };
}

function mundosPropiosDe(config: CursoConfigMundos | null): MundoPropioExportado[] {
  return (config?.mundos ?? [])
    .filter((m) => m.worldId.startsWith('cw_'))
    .map((m) => ({
      worldId: m.worldId,
      activo: m.activo,
      nombre: m.nombre,
      descripcion: m.descripcion,
      subtitle: m.subtitle,
      competencia: m.competencia,
    }));
}

function contenidoLimpio(
  contenido: Record<string, ContenidoMundo>
): ClaseExportada['contenidoPropio'] {
  const out: ClaseExportada['contenidoPropio'] = {};
  for (const [worldId, piezas] of Object.entries(contenido)) {
    const mundo: ClaseExportada['contenidoPropio'][string] = {};
    for (const p of PIEZAS_QUIZ) {
      const doc = piezas[p];
      if (doc) mundo[p] = { items: doc.items ?? [] };
    }
    if (piezas.teoria) mundo.teoria = { cards: piezas.teoria.cards ?? [] };
    if (Object.keys(mundo).length > 0) out[worldId] = mundo;
  }
  return out;
}

/** Arma el objeto que se descarga. Puro y serializable. */
export function armarExportacion(entrada: EntradaExportacion): Exportacion {
  const exportacion: Exportacion = {
    formato: FORMATO_EXPORTACION,
    generadoAt: new Date(entrada.ahora).toISOString(),
    profe: {
      uid: entrada.profe.uid,
      nombre: entrada.profe.nombre ?? null,
      correo: entrada.profe.correo ?? null,
    },
    colegio: { id: entrada.colegio.id, nombre: entrada.colegio.nombre ?? null },
    plan: entrada.plan,
    clases: entrada.clases.map(({ curso, config, contenido }) => ({
      id: curso.id,
      nombre: curso.nombre,
      grado: curso.grado,
      codigo: curso.codigo ?? null,
      creadaAt: curso.createdAt ?? null,
      config: configLimpia(config),
      mundosPropios: mundosPropiosDe(config),
      contenidoPropio: contenidoLimpio(contenido),
    })),
  };
  return sinUndefined(exportacion);
}

/** 'ceti-mis-datos-YYYY-MM-DD.json' con la fecha de Bogotá. */
export function nombreArchivoExportacion(ahora: number): string {
  return `ceti-mis-datos-${fechaBogota(ahora)}.json`;
}

export interface ParametrosExportacion {
  uid: string;
  colegioId: string;
  nombre: string | null;
  correo: string | null;
  plan: PlanId;
  ahora?: number;
}

/** Lee las clases del profe, su configuración y las piezas que él escribió. */
export async function recopilarDatosProfe(
  params: ParametrosExportacion
): Promise<EntradaExportacion> {
  const { uid, colegioId } = params;
  const [cursos, colegioNombre] = await Promise.all([
    rosterRepository.getCursosByProfesor(colegioId, uid),
    rosterRepository.getColegioNombre(colegioId),
  ]);

  const clases = await Promise.all(
    cursos.map(async (curso): Promise<ClaseEntrada> => {
      const config = await classConfigRepository.get(colegioId, curso.id);
      const contenido: Record<string, ContenidoMundo> = {};
      const lecturas: Promise<void>[] = [];
      for (const [worldId, flags] of Object.entries(config?.overrides ?? {})) {
        if (!flags) continue;
        const mundo: ContenidoMundo = {};
        contenido[worldId] = mundo;
        for (const pieza of PIEZAS_QUIZ) {
          if (!flags[pieza]) continue;
          lecturas.push(
            courseContentRepository
              .loadResolvedBanco(
                colegioId,
                curso.id,
                curso.grado,
                worldId,
                pieza as PiezaQuiz,
                true
              )
              .then(({ doc, source }) => {
                if (source === 'custom' && doc) mundo[pieza] = doc;
              })
          );
        }
        if (flags.teoria) {
          lecturas.push(
            courseContentRepository
              .loadResolvedMicroteoria(colegioId, curso.id, curso.grado, worldId, true)
              .then(({ doc, source }) => {
                if (source === 'custom' && doc) mundo.teoria = doc;
              })
          );
        }
      }
      await Promise.all(lecturas);
      return { curso, config, contenido };
    })
  );

  return {
    ahora: params.ahora ?? Date.now(),
    profe: { uid, nombre: params.nombre, correo: params.correo },
    colegio: { id: colegioId, nombre: colegioNombre },
    plan: params.plan,
    clases,
  };
}

/** Recopila, arma y descarga el JSON. false en nativo (solo web). */
export async function exportarMisDatos(params: ParametrosExportacion): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const entrada = await recopilarDatosProfe(params);
  const json = JSON.stringify(armarExportacion(entrada), null, 2);
  return downloadTextFile(
    nombreArchivoExportacion(entrada.ahora),
    json,
    'application/json;charset=utf-8;'
  );
}
