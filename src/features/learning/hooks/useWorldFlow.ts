/**
 * useWorldFlow — pure orchestration hook for the three-phase world saga flow.
 *
 * Extracted from WorldSagaScreen so the phase-transition logic is unit-testable
 * without mounting Expo Router components or the full RN tree.
 *
 * The screen becomes a thin consumer:
 *   const { phase, situacion, microteoriaBank, handleECFinish, handleMTFinish } =
 *     useWorldFlow(uid, grado, worldId);
 *
 * Phases:
 *   'loading'      — waiting for repos or grado to resolve
 *   'eligecamino'  — show EligeCaminoView (only when trigger+bank+situaciones present)
 *   'microteoria'  — show MicroteoriaView (only first-time-per-uid+worldId)
 *   'quiz'         — show WorldQuizScreen (default / graceful fallback)
 *
 * Graceful degradation (R12, RQ-ES02):
 *   - If both repos return null → goes to 'quiz' (no infinite spinner).
 *   - If a repo THROWS unexpectedly → caught here, treated as null, goes to 'quiz'.
 *   - EligeCamino trigger true but bank empty/null → skips to microteoria/quiz.
 *   - MicroteoriaBank null or already seen → skips to quiz.
 *
 * RQ-ES02, RQ-FN09, RQ-ES06.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLearningFlowStore } from '@features/learning/store/useLearningFlowStore';
import { eligeCaminoRepository } from '@features/learning/data/eligeCaminoRepository';
import { microteoriaRepository } from '@features/learning/data/microteoriaRepository';
import { shouldShowEligeCamino, pickSituacion } from '@features/learning/data/eligeCaminoUtils';
import type { MicroteoriaBank, Situacion } from '@features/learning/data/content.types';
import type { Grado, WorldId } from '@features/learning/data/quiz.types';

export type WorldFlowPhase = 'loading' | 'eligecamino' | 'microteoria' | 'quiz';

export interface WorldFlowResult {
  phase: WorldFlowPhase;
  situacion: Situacion | null;
  microteoriaBank: MicroteoriaBank | null;
  handleECFinish: () => void;
  handleMTFinish: () => void;
}

/**
 * Resolves the three-phase flow for a given (uid, grado, worldId).
 *
 * @param uid       Firebase UID (or local/demo fallback).
 * @param grado     Student's grade — null while still resolving (spinner gate).
 * @param worldId   The world being entered.
 */
export function useWorldFlow(
  uid: string,
  grado: Grado | null,
  worldId: string | undefined
): WorldFlowResult {
  const hasMicroteoriaSeen = useLearningFlowStore((s) => s.hasMicroteoriaSeen);
  const markMicroteoriaSeen = useLearningFlowStore((s) => s.markMicroteoriaSeen);

  const [phase, setPhase] = useState<WorldFlowPhase>('loading');
  const [situacion, setSituacion] = useState<Situacion | null>(null);
  const [microteoriaBank, setMicroteoriaBank] = useState<MicroteoriaBank | null>(null);

  // Guard against re-running the effect for the same (uid, grado, worldId) triple.
  const initialisedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!grado || !worldId) return;

    const flowKey = `${uid}:${grado}:${worldId}`;
    if (initialisedRef.current === flowKey) return;
    initialisedRef.current = flowKey;

    // Reset phase to loading when the key changes (new world / new user).
    setPhase('loading');
    setSituacion(null);
    setMicroteoriaBank(null);

    void (async () => {
      // Fetch both banks in parallel; treat any unexpected throw as null (fail-soft).
      let ecBank = null;
      let mtBank = null;
      try {
        [ecBank, mtBank] = await Promise.all([
          eligeCaminoRepository.fetch(grado as Grado, worldId as WorldId),
          microteoriaRepository.fetch(grado as Grado, worldId as WorldId),
        ]);
      } catch {
        // Both failed catastrophically — degrade to quiz.
        setPhase('quiz');
        return;
      }

      // Resolve which phases to show.
      const showEC =
        shouldShowEligeCamino(uid, worldId) && ecBank !== null && ecBank.situaciones.length > 0;

      const alreadySeenMT = hasMicroteoriaSeen(uid, worldId);
      const showMT = !alreadySeenMT && mtBank !== null && mtBank.cards.length > 0;

      if (showEC && ecBank) {
        setSituacion(pickSituacion(uid, worldId, ecBank.situaciones));
      }

      if (showMT) {
        setMicroteoriaBank(mtBank);
      }

      // Determine starting phase — always terminates at 'quiz' as the final fallback.
      if (showEC && ecBank) {
        setPhase('eligecamino');
      } else if (showMT) {
        setPhase('microteoria');
      } else {
        setPhase('quiz');
      }
    })();
  }, [grado, worldId, uid, hasMicroteoriaSeen]);

  const handleECFinish = useCallback(() => {
    // After EligeCamino, go to micro-teoría if available, else quiz.
    if (microteoriaBank !== null) {
      setPhase('microteoria');
    } else {
      setPhase('quiz');
    }
  }, [microteoriaBank]);

  const handleMTFinish = useCallback(() => {
    markMicroteoriaSeen(uid, worldId ?? '');
    setPhase('quiz');
  }, [markMicroteoriaSeen, uid, worldId]);

  return { phase, situacion, microteoriaBank, handleECFinish, handleMTFinish };
}
