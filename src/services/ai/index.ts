export {
  adaptQuestion,
  getRecommendedPath,
  analyzeWeaknesses,
  defaultAiProfile,
  updateProfileWithAnswer,
  classifyConcepts,
  isValidWorldId,
} from './aiService';

export type {
  AiUserProfile,
  QuestionAnswer,
  AdaptQuestionInput,
  AdaptedQuestion,
  GetRecommendedPathInput,
  RecommendedPath,
  AnalyzeWeaknessesInput,
  WeaknessReport,
} from './aiService.types';
