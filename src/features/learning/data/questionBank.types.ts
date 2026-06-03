export type WorldId = 'world_1' | 'world_2' | 'world_3' | 'world_4' | 'world_5';

export type QuestionDifficulty = 'basic' | 'intermediate' | 'advanced';

export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'calculation';

export interface QuestionBankItem {
  id: string;
  worldId: WorldId;
  concept: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  isAdaptable: boolean;
  content: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
  aiHints: {
    neutralContext: string;
    adaptableElements: string[];
  };
  metadata: {
    createdAt: number;
    version: number;
    reviewedBy: string;
  };
}
