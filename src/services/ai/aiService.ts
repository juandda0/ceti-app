/**
 * AI service abstraction layer.
 *
 * All methods are stubs that return safe, no-op results.
 * When an AI provider (e.g. Claude API) is integrated, replace each
 * stub body with the real API call — the signatures and return types
 * are already wired throughout the app.
 *
 * Firestore profile path: /users/{uid}/aiProfile/state
 */

import type {
  AdaptQuestionInput,
  AdaptedQuestion,
  GetRecommendedPathInput,
  RecommendedPath,
  AnalyzeWeaknessesInput,
  WeaknessReport,
  AiUserProfile,
} from './aiService.types';
import type { WorldId } from '@features/learning/data/quiz.types';

// ─── adaptQuestion ────────────────────────────────────────────────────────────

/**
 * Returns the question adapted to the user's learning profile and context.
 *
 * Stub: passes the question through unchanged.
 *
 * Future: send question.aiHints + profile to AI provider and receive
 * a rewritten question body that uses familiar examples for the user.
 */
export async function adaptQuestion(input: AdaptQuestionInput): Promise<AdaptedQuestion> {
  // TODO(AI): call AI provider with input.question.aiHints and input.profile
  return {
    questionId: input.question.id,
    content: input.question.content,
    wasAdapted: false,
  };
}

// ─── getRecommendedPath ───────────────────────────────────────────────────────

/**
 * Returns an ordered list of question IDs the user should tackle next
 * within a world, prioritizing weak concepts.
 *
 * Stub: returns availableQuestionIds minus completed, in their original order.
 *
 * Future: rank by predicted difficulty match and concept gap from profile.
 */
export async function getRecommendedPath(input: GetRecommendedPathInput): Promise<RecommendedPath> {
  // TODO(AI): rank questions by concept mastery gaps in input.profile
  const completedSet = new Set(input.completedQuestionIds);
  const remaining = input.availableQuestionIds.filter((id) => !completedSet.has(id));

  return {
    worldId: input.worldId,
    questionIds: remaining,
    reasoning: 'Default order — AI analysis not yet connected.',
  };
}

// ─── analyzeWeaknesses ───────────────────────────────────────────────────────

/**
 * Analyzes the user's answer history for a world and returns a weakness report.
 *
 * Stub: returns an empty report with the average accuracy computed locally.
 *
 * Future: send full answer history to AI provider for concept-level analysis
 * and personalized recommendations.
 */
export async function analyzeWeaknesses(input: AnalyzeWeaknessesInput): Promise<WeaknessReport> {
  // TODO(AI): send input.answerHistory to AI provider for concept analysis
  const total = input.answerHistory.length;
  const correct = input.answerHistory.filter((a) => a.isCorrect).length;
  const overallScore = total > 0 ? correct / total : 0;

  return {
    worldId: input.worldId,
    weakConcepts: [],
    recommendedFocus: [],
    overallScore,
  };
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

/**
 * Returns a default (empty) AI profile for a new user.
 * Used before any analysis has been run.
 */
export function defaultAiProfile(uid: string): AiUserProfile {
  return {
    uid,
    conceptMastery: {},
    preferredDifficulty: 'basic',
    weakConcepts: [],
    strongConcepts: [],
    totalQuestionsAnswered: 0,
    lastAnalyzedAt: 0,
  };
}

/**
 * Updates a profile in-place with the result of a single answered question.
 * Call this locally after each answer; persist to Firestore /aiProfile/state
 * after a session ends.
 *
 * Stub: increments totalQuestionsAnswered and updates conceptMastery with a
 * simple running average. Replace with AI-informed weighting when connected.
 */
export function updateProfileWithAnswer(
  profile: AiUserProfile,
  answer: { concept: string; isCorrect: boolean }
): AiUserProfile {
  const prev = profile.conceptMastery[answer.concept] ?? 0.5;
  // Simple exponential moving average: new = 0.7 * prev + 0.3 * result
  const next = 0.7 * prev + 0.3 * (answer.isCorrect ? 1 : 0);

  return {
    ...profile,
    totalQuestionsAnswered: profile.totalQuestionsAnswered + 1,
    conceptMastery: { ...profile.conceptMastery, [answer.concept]: next },
    lastAnalyzedAt: Date.now(),
  };
}

/** Derives weakConcepts and strongConcepts from conceptMastery scores. */
export function classifyConcepts(
  profile: AiUserProfile
): Pick<AiUserProfile, 'weakConcepts' | 'strongConcepts'> {
  const entries = Object.entries(profile.conceptMastery);
  const weakConcepts = entries.filter(([, score]) => score < 0.6).map(([c]) => c);
  const strongConcepts = entries.filter(([, score]) => score >= 0.8).map(([c]) => c);
  return { weakConcepts, strongConcepts };
}

// ─── World ID helpers ─────────────────────────────────────────────────────────

export function isValidWorldId(value: string): value is WorldId {
  return ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'].includes(value);
}
