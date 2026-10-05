/**
 * courseContentRepository — professor-side writes of course-custom content
 * (D-ORQ, RQ-PR11). Copy-on-write: the global defaults are NEVER mutated; the
 * first save of a piece copies it (with the edit applied) into
 * the course's contenido and flips the piece's override flag in the
 * class-config doc — both in ONE backend transaction, so there is never a mixed state. Every
 * save bumps the config `version`, which is the students' cache-invalidation
 * key. "Restaurar default" deletes the copy and clears the flag (also a batch).
 */
import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import { contentPath, contenidoDocId, cursoPath } from '@shared/lib/api/paths';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { WORLD_ORDER } from '@features/learning/data/competencias';
import type { BancoDoc, Grado, QuizTipo } from '@features/learning/data/quiz.types';
import type { MicroteoriaBank } from '@features/learning/data/content.types';
import type { CursoConfigMundos, WorldContentOverrides } from '@shared/types/tenancy';

export type ContentPiece = 'mc' | 'vf' | 'ordenar' | 'teoria' | 'eligeCamino';

export const PIECE_TO_TIPO: Record<'mc' | 'vf' | 'ordenar', QuizTipo> = {
  mc: 'multiple_choice',
  vf: 'true_false',
  ordenar: 'ordenar',
};

function contenidoPath(colegioId: string, cursoId: string, docId: string): string {
  return `${cursoPath(colegioId, cursoId)}/contenido/${seg(docId)}`;
}

/** Contenido + config en UNA transacción del backend: nunca queda un estado mixto. */
async function commitBatch(
  colegioId: string,
  cursoId: string,
  batch: { config: CursoConfigMundos; set?: Record<string, unknown>; delete?: string[] }
): Promise<void> {
  await api.post(`${cursoPath(colegioId, cursoId)}/contenido/batch`, batch);
  classConfigRepository.notifyChanged(colegioId, cursoId);
}

function docIdForPiece(worldId: string, piece: ContentPiece): string {
  if (piece === 'teoria') return contenidoDocId.microteoria(worldId);
  if (piece === 'eligeCamino') return contenidoDocId.eligeCamino(worldId);
  return contenidoDocId.banco(worldId, PIECE_TO_TIPO[piece]);
}

/**
 * Full next config doc: existing config (or the defaults when the course was
 * never configured) + the given mutation, with version bumped and authorship
 * stamped — matches the rules' shape requirements on create and update.
 */
function buildNextConfig(
  config: CursoConfigMundos | null,
  uid: string,
  mutate: (draft: CursoConfigMundos) => void
): CursoConfigMundos {
  const draft: CursoConfigMundos = config
    ? {
        ...config,
        mundos: config.mundos.map((m) => ({ ...m })),
        overrides: { ...(config.overrides ?? {}) },
      }
    : {
        mundos: WORLD_ORDER.map((worldId) => ({ worldId: worldId as string, activo: true })),
        overrides: {},
        version: 0,
        updatedAt: 0,
        updatedByUid: uid,
      };
  mutate(draft);
  draft.version = (config?.version ?? 0) + 1;
  draft.updatedAt = Date.now();
  draft.updatedByUid = uid;
  return draft;
}

function setOverrideFlag(
  draft: CursoConfigMundos,
  worldId: string,
  piece: ContentPiece,
  value: boolean
) {
  const overrides = { ...(draft.overrides ?? {}) };
  const world: WorldContentOverrides = { ...(overrides[worldId] ?? {}) };
  if (value) {
    world[piece] = true;
  } else {
    delete world[piece];
  }
  if (Object.keys(world).length > 0) {
    overrides[worldId] = world;
  } else {
    delete overrides[worldId];
  }
  draft.overrides = overrides;
}

export const courseContentRepository = {
  /**
   * Resolved quiz banco for the editor: the course copy when overridden, else
   * the global default. Returns the source so the UI can show "personalizado".
   */
  async loadResolvedBanco(
    colegioId: string,
    cursoId: string,
    grado: Grado,
    worldId: string,
    piece: 'mc' | 'vf' | 'ordenar',
    isCustom: boolean
  ): Promise<{ doc: BancoDoc | null; source: 'custom' | 'default' }> {
    if (!isBackendConfigured()) return { doc: null, source: 'default' };
    const tipo = PIECE_TO_TIPO[piece];
    if (isCustom) {
      const doc = await api.getOrNull<BancoDoc>(
        contenidoPath(colegioId, cursoId, docIdForPiece(worldId, piece))
      );
      if (doc) return { doc, source: 'custom' };
    }
    return {
      doc: await api.getOrNull<BancoDoc>(contentPath.banco(grado, worldId, tipo)),
      source: 'default',
    };
  },

  async loadResolvedMicroteoria(
    colegioId: string,
    cursoId: string,
    grado: Grado,
    worldId: string,
    isCustom: boolean
  ): Promise<{ doc: MicroteoriaBank | null; source: 'custom' | 'default' }> {
    if (!isBackendConfigured()) return { doc: null, source: 'default' };
    if (isCustom) {
      const doc = await api.getOrNull<MicroteoriaBank>(
        contenidoPath(colegioId, cursoId, docIdForPiece(worldId, 'teoria'))
      );
      if (doc) return { doc, source: 'custom' };
    }
    return {
      doc: await api.getOrNull<MicroteoriaBank>(contentPath.microteoria(grado, worldId)),
      source: 'default',
    };
  },

  /**
   * Copy-on-write save of one piece: contenido doc + config override flag +
   * version bump, atomically. `config` is the professor's current config (or
   * null when the course was never configured).
   */
  async savePiece(params: {
    colegioId: string;
    cursoId: string;
    uid: string;
    config: CursoConfigMundos | null;
    worldId: string;
    piece: ContentPiece;
    doc: Record<string, unknown>;
  }): Promise<boolean> {
    const { colegioId, cursoId, uid, config, worldId, piece } = params;
    if (!isBackendConfigured()) return false;
    const nextConfig = buildNextConfig(config, uid, (draft) =>
      setOverrideFlag(draft, worldId, piece, true)
    );
    await commitBatch(colegioId, cursoId, {
      config: nextConfig,
      set: { [docIdForPiece(worldId, piece)]: params.doc },
    });
    return true;
  },

  /** "Restaurar default" for one piece: delete the copy + clear the flag. */
  async restorePiece(params: {
    colegioId: string;
    cursoId: string;
    uid: string;
    config: CursoConfigMundos | null;
    worldId: string;
    piece: ContentPiece;
  }): Promise<boolean> {
    const { colegioId, cursoId, uid, config, worldId, piece } = params;
    if (!isBackendConfigured()) return false;
    const nextConfig = buildNextConfig(config, uid, (draft) =>
      setOverrideFlag(draft, worldId, piece, false)
    );
    await commitBatch(colegioId, cursoId, {
      config: nextConfig,
      delete: [docIdForPiece(worldId, piece)],
    });
    return true;
  },

  /**
   * Creates a custom world (RQ-PR12) in ONE batch: the config entry (as a
   * DRAFT — activo:false, invisible to students) + any provided content docs
   * with their override flags. Atomic: a failure leaves nothing behind.
   */
  async createCustomWorld(params: {
    colegioId: string;
    cursoId: string;
    uid: string;
    config: CursoConfigMundos | null;
    /** Caller-minted `cw_*` id (it is embedded in the piece docs too). */
    worldId: string;
    meta: { nombre: string; subtitle?: string; descripcion?: string; competencia?: string };
    /** Content docs keyed by piece (already validated by the caller). */
    pieces?: Partial<Record<ContentPiece, Record<string, unknown>>>;
  }): Promise<string | null> {
    const { colegioId, cursoId, uid, config, worldId, meta, pieces } = params;
    if (!isBackendConfigured()) return null;
    const set: Record<string, unknown> = {};
    for (const [piece, doc] of Object.entries(pieces ?? {})) {
      set[docIdForPiece(worldId, piece as ContentPiece)] = doc;
    }
    const nextConfig = buildNextConfig(config, uid, (draft) => {
      draft.mundos = [
        ...draft.mundos,
        {
          worldId,
          activo: false,
          nombre: meta.nombre.trim(),
          subtitle: meta.subtitle?.trim() || undefined,
          descripcion: meta.descripcion?.trim() || undefined,
          competencia: meta.competencia || undefined,
        },
      ];
      for (const piece of Object.keys(pieces ?? {})) {
        setOverrideFlag(draft, worldId, piece as ContentPiece, true);
      }
    });
    await commitBatch(colegioId, cursoId, { config: nextConfig, set });
    return worldId;
  },

  /**
   * Activation gate for a custom world (RQ-PR12 CA1): its course content must
   * cover the quiz sampling minimums (4 MC + 3 V/F + 3 ordenar) and ≥1 theory
   * card, so students never see an empty world.
   */
  async checkCustomWorldReady(
    colegioId: string,
    cursoId: string,
    worldId: string
  ): Promise<{ ready: boolean; faltan: ('mc' | 'vf' | 'ordenar' | 'teoria')[] }> {
    if (!isBackendConfigured()) return { ready: false, faltan: ['mc', 'vf', 'ordenar', 'teoria'] };
    const minimums = { mc: 4, vf: 3, ordenar: 3, teoria: 1 } as const;
    const reads = await Promise.all(
      (['mc', 'vf', 'ordenar', 'teoria'] as const).map(async (piece) => {
        const data = await api.getOrNull<Record<string, unknown>>(
          contenidoPath(colegioId, cursoId, docIdForPiece(worldId, piece))
        );
        const list = (piece === 'teoria' ? data?.cards : data?.items) as unknown[] | undefined;
        return { piece, count: list?.length ?? 0 };
      })
    );
    const faltan = reads.filter((r) => r.count < minimums[r.piece]).map((r) => r.piece);
    return { ready: faltan.length === 0, faltan };
  },

  /**
   * Deletes a custom world (RQ-PR12 CA4): its content docs + its config entry
   * and override flags, in one batch. The content is gone (irreversible); the
   * students' progress docs are kept as history (reports tolerate them).
   */
  async deleteCustomWorld(params: {
    colegioId: string;
    cursoId: string;
    uid: string;
    config: CursoConfigMundos | null;
    worldId: string;
  }): Promise<boolean> {
    const { colegioId, cursoId, uid, config, worldId } = params;
    if (!isBackendConfigured()) return false;
    const pieces: ContentPiece[] = ['mc', 'vf', 'ordenar', 'teoria', 'eligeCamino'];
    const nextConfig = buildNextConfig(config, uid, (draft) => {
      draft.mundos = draft.mundos.filter((m) => m.worldId !== worldId);
      const overrides = { ...(draft.overrides ?? {}) };
      delete overrides[worldId];
      draft.overrides = overrides;
    });
    await commitBatch(colegioId, cursoId, {
      config: nextConfig,
      delete: pieces.map((piece) => docIdForPiece(worldId, piece)),
    });
    return true;
  },

  /**
   * Duplicates a custom world into ANOTHER course of the same professor
   * (RQ-PR12 CA4): copies its content docs and appends a draft entry to the
   * target's config. The target course serves its own copy from then on.
   */
  async duplicateCustomWorld(params: {
    colegioId: string;
    fromCursoId: string;
    toCursoId: string;
    uid: string;
    worldId: string;
  }): Promise<boolean> {
    const { colegioId, fromCursoId, toCursoId, uid, worldId } = params;
    if (!isBackendConfigured()) return false;
    const configOf = (c: string) =>
      api.getOrNull<CursoConfigMundos>(`${cursoPath(colegioId, c)}/config`);
    const [fromConfig, toConfig] = await Promise.all([configOf(fromCursoId), configOf(toCursoId)]);
    const entry = fromConfig?.mundos.find((m) => m.worldId === worldId);
    if (!entry) return false;
    if (toConfig?.mundos.some((m) => m.worldId === worldId)) return false; // already there

    const pieces: ContentPiece[] = ['mc', 'vf', 'ordenar', 'teoria', 'eligeCamino'];
    const docs = await Promise.all(
      pieces.map(async (piece) => {
        const data = await api.getOrNull<Record<string, unknown>>(
          contenidoPath(colegioId, fromCursoId, docIdForPiece(worldId, piece))
        );
        return { piece, data };
      })
    );

    const set: Record<string, unknown> = {};
    for (const { piece, data } of docs) {
      if (data) set[docIdForPiece(worldId, piece)] = data;
    }
    const nextConfig = buildNextConfig(toConfig, uid, (draft) => {
      draft.mundos = [...draft.mundos, { ...entry, activo: false }];
      for (const { piece, data } of docs) {
        if (data) setOverrideFlag(draft, worldId, piece, true);
      }
    });
    await commitBatch(colegioId, toCursoId, { config: nextConfig, set });
    return true;
  },

  /**
   * Display overrides of a world (nombre/subtitle/descripcion) live on the
   * config entry itself — a config-only write. Empty strings clear the field
   * (back to the default world's metadata).
   */
  async saveWorldMeta(params: {
    colegioId: string;
    cursoId: string;
    uid: string;
    config: CursoConfigMundos | null;
    worldId: string;
    meta: { nombre?: string; subtitle?: string; descripcion?: string };
  }): Promise<boolean> {
    const { colegioId, cursoId, uid, config, worldId, meta } = params;
    if (!isBackendConfigured()) return false;
    const nextConfig = buildNextConfig(config, uid, (draft) => {
      draft.mundos = draft.mundos.map((m) => {
        if (m.worldId !== worldId) return m;
        const entry = { ...m };
        for (const key of ['nombre', 'subtitle', 'descripcion'] as const) {
          const value = meta[key]?.trim();
          if (value) {
            entry[key] = value;
          } else {
            delete entry[key];
          }
        }
        return entry;
      });
    });
    return classConfigRepository.upsert(colegioId, cursoId, nextConfig);
  },
};
