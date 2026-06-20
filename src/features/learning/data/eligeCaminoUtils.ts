/**
 * Deterministic EligeCamino trigger and picker utilities.
 *
 * Extracted from the saga orchestrator so they are unit-testable without
 * importing Expo Router components (which can't resolve in Jest).
 *
 * R7: no Math.random — all decisions use hashStr (djb2 variant).
 * R5: the student's choice is never persisted; these helpers only decide
 *     which phase/situacion to show, not what the student answered.
 */
import { hashStr } from '@shared/lib/quizUtils';
import type { Situacion } from './content.types';

/**
 * Returns true iff this (uid, worldId) pair should show the EligeCamino phase.
 *
 * Implementation: hashStr(`${uid}:eligecamino:${worldId}`) % 100 < 30
 * This yields a stable, reproducible ~30% trigger per (student, world).
 * Same student always gets the same trigger for the same world (R7).
 */
export function shouldShowEligeCamino(uid: string, worldId: string): boolean {
  return hashStr(`${uid}:eligecamino:${worldId}`) % 100 < 30;
}

/**
 * Picks one situacion from the bank deterministically.
 *
 * Uses seed suffix ':ec-pick' so the pick is independent from the
 * show/no-show decision in shouldShowEligeCamino.
 */
export function pickSituacion(uid: string, worldId: string, situaciones: Situacion[]): Situacion {
  const idx = hashStr(`${uid}:ec-pick:${worldId}`) % situaciones.length;
  return situaciones[idx]!;
}
