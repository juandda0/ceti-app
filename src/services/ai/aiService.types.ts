import type { WorldId } from '@features/learning/data/quiz.types';

/**
 * Legacy difficulty enum (authoring-time only). R7: not used at runtime.
 * @deprecated aiService is legacy/stub; these types remain only to avoid
 * breaking compilation while the pivot baseline decrements.
 */
type QuestionDifficulty = 'basic' | 'intermediate' | 'advanced';

/**
 * Legacy question shape stub (authoring-time only, R5/R7).
 * @deprecated This service is a no-op stub; no real QuestionBankItem exists.
 */
interface LegacyQuestionStub {
  id: string;
  content: { question: string; options: string[]; correctAnswer: string; explanation: string };
}

// ─── User AI Profile (Firestore: /users/{uid}/aiProfile/state) ───────────────

export interface AiUserProfile {
  uid: string;
  /** concept name → mastery score 0–1 */
  conceptMastery: Record<string, number>;
  preferredDifficulty: QuestionDifficulty;
  weakConcepts: string[];
  strongConcepts: string[];
  totalQuestionsAnswered: number;
  lastAnalyzedAt: number;
}

// ─── Answer History ───────────────────────────────────────────────────────────

export interface QuestionAnswer {
  questionId: string;
  worldId: WorldId;
  concept: string;
  difficulty: QuestionDifficulty;
  isCorrect: boolean;
  timeSpentMs: number;
  answeredAt: number;
}

// ─── adaptQuestion ────────────────────────────────────────────────────────────

export interface AdaptQuestionInput {
  question: LegacyQuestionStub;
  profile: AiUserProfile;
}

export interface AdaptedQuestion {
  questionId: string;
  content: LegacyQuestionStub['content'];
  /** true when the AI actually modified the question context */
  wasAdapted: boolean;
}

// ─── getRecommendedPath ───────────────────────────────────────────────────────

export interface GetRecommendedPathInput {
  worldId: WorldId;
  availableQuestionIds: string[];
  completedQuestionIds: string[];
  profile: AiUserProfile;
}

export interface RecommendedPath {
  worldId: WorldId;
  /** Ordered list of question IDs the AI recommends tackling next */
  questionIds: string[];
  reasoning: string;
}

// ─── analyzeWeaknesses ───────────────────────────────────────────────────────

export interface AnalyzeWeaknessesInput {
  worldId: WorldId;
  answerHistory: QuestionAnswer[];
}

export interface WeaknessReport {
  worldId: WorldId;
  /** Concepts where accuracy < 0.6 */
  weakConcepts: string[];
  /** Concepts to revisit or focus on next session */
  recommendedFocus: string[];
  /** Average accuracy across all answered questions 0–1 */
  overallScore: number;
}
