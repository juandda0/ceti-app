/**
 * courseContentRepository — professor-side writes of course-custom content
 * (D-ORQ, RQ-PR11). Copy-on-write: the global defaults are NEVER mutated; the
 * first save of a piece copies it (with the edit applied) into
 * `cursos/{cursoId}/contenido/*` and flips the piece's override flag in the
 * class-config doc — both in ONE batch, so there is never a mixed state. Every
 * save bumps the config `version`, which is the students' cache-invalidation
 * key. "Restaurar default" deletes the copy and clears the flag (also a batch).
 */
import { getDoc, writeBatch } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  bancoDocRef,
  contenidoDocId,
  cursoConfigMundosDocRef,
  cursoContenidoDocRef,
  microteoriaDocRef,
} from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
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
        modoEnfocado: { ...config.modoEnfocado },
        overrides: { ...(config.overrides ?? {}) },
      }
    : {
        mundos: WORLD_ORDER.map((worldId) => ({ worldId: worldId as string, activo: true })),
        modoEnfocado: { activo: false },
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
    const clients = getFirebaseClients();
    if (!clients?.firestore) return { doc: null, source: 'default' };
    const tipo = PIECE_TO_TIPO[piece];
    if (isCustom) {
      const snap = await getDoc(
        cursoContenidoDocRef(clients.firestore, colegioId, cursoId, docIdForPiece(worldId, piece))
      );
      if (snap.exists()) return { doc: snap.data() as BancoDoc, source: 'custom' };
    }
    const snap = await getDoc(bancoDocRef(clients.firestore, grado, worldId, tipo));
    return { doc: snap.exists() ? (snap.data() as BancoDoc) : null, source: 'default' };
  },

  async loadResolvedMicroteoria(
    colegioId: string,
    cursoId: string,
    grado: Grado,
    worldId: string,
    isCustom: boolean
  ): Promise<{ doc: MicroteoriaBank | null; source: 'custom' | 'default' }> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return { doc: null, source: 'default' };
    if (isCustom) {
      const snap = await getDoc(
        cursoContenidoDocRef(
          clients.firestore,
          colegioId,
          cursoId,
          docIdForPiece(worldId, 'teoria')
        )
      );
      if (snap.exists()) return { doc: snap.data() as MicroteoriaBank, source: 'custom' };
    }
    const snap = await getDoc(microteoriaDocRef(clients.firestore, grado, worldId));
    return { doc: snap.exists() ? (snap.data() as MicroteoriaBank) : null, source: 'default' };
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
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const batch = writeBatch(clients.firestore);
    batch.set(
      cursoContenidoDocRef(clients.firestore, colegioId, cursoId, docIdForPiece(worldId, piece)),
      stripUndefinedValues(params.doc)
    );
    const nextConfig = buildNextConfig(config, uid, (draft) =>
      setOverrideFlag(draft, worldId, piece, true)
    );
    batch.set(
      cursoConfigMundosDocRef(clients.firestore, colegioId, cursoId),
      stripUndefinedValues({ ...nextConfig } as Record<string, unknown>)
    );
    await batch.commit();
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
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const batch = writeBatch(clients.firestore);
    batch.delete(
      cursoContenidoDocRef(clients.firestore, colegioId, cursoId, docIdForPiece(worldId, piece))
    );
    const nextConfig = buildNextConfig(config, uid, (draft) =>
      setOverrideFlag(draft, worldId, piece, false)
    );
    batch.set(
      cursoConfigMundosDocRef(clients.firestore, colegioId, cursoId),
      stripUndefinedValues({ ...nextConfig } as Record<string, unknown>)
    );
    await batch.commit();
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
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
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
    const { setDoc } = await import('firebase/firestore');
    await setDoc(
      cursoConfigMundosDocRef(clients.firestore, colegioId, cursoId),
      stripUndefinedValues({ ...nextConfig } as Record<string, unknown>),
      { merge: false }
    );
    return true;
  },
};
