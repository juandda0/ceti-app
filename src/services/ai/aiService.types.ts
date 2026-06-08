import type {
  QuestionBankItem,
  WorldId,
  QuestionDifficulty,
} from '@features/learning/data/questionBank.types';

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
  question: QuestionBankItem;
  profile: AiUserProfile;
}

export interface AdaptedQuestion {
  questionId: string;
  /** Adapted content — same shape as QuestionBankItem.content */
  content: QuestionBankItem['content'];
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
