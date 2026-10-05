/**
 * useClassConfig — live class configuration for the signed-in student
 * (D-ORQ, RQ-PR10 CA3). Subscribes to `cursos/{cursoId}/config/mundos` via
 * polling so the professor's edits reach the student within seconds.
 *
 * `config: null` = no config (doc absent, offline, demo without tenant) →
 * callers resolve to the defaults (classConfig.ts), i.e. pre-D-ORQ behavior.
 * `loaded` flips true after the first snapshot (or immediately without a
 * tenant), letting callers distinguish "still resolving" from "no config" —
 * the saga entry guard needs that to not act on a transient default.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import type { CursoConfigMundos } from '@shared/types/tenancy';

export interface ClassConfigState {
  config: CursoConfigMundos | null;
  loaded: boolean;
}

export function useClassConfig(): ClassConfigState {
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const [state, setState] = useState<ClassConfigState>({ config: null, loaded: false });

  useEffect(() => {
    if (!colegioId || !cursoId) {
      setState({ config: null, loaded: true });
      return;
    }
    setState({ config: null, loaded: false });
    return classConfigRepository.subscribe(colegioId, cursoId, (config) =>
      setState({ config, loaded: true })
    );
  }, [colegioId, cursoId]);

  return state;
}
