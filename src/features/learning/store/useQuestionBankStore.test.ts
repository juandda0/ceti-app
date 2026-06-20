import {
  useQuestionBankStore,
  QUESTIONS_PER_WORLD,
} from '@features/learning/store/useQuestionBankStore';
import type { QuizItem, WorldId } from '@features/learning/data/quiz.types';

jest.mock('@features/learning/data/QuestionBankRepository', () => ({
  questionBankRepository: { fetchAssembledQuiz: jest.fn() },
}));
// eslint-disable-next-line import/first
import { questionBankRepository } from '@features/learning/data/QuestionBankRepository';
const mockFetch = questionBankRepository.fetchAssembledQuiz as jest.Mock;

const UID = 'user-1';
const WORLD: WorldId = 'world_1';

function makeQuestion(id: string): QuizItem {
  return {
    id,
    tipo: 'multiple_choice',
    enunciado: `q-${id}`,
    opciones: ['a', 'b'],
    correctIndex: 0,
    competencia: 'ahorro',
    dificultad: 1,
    explicacion: 'because',
  };
}

/** Seed N fake questions into world_1 (bypasses network fetch). */
function seedQuestions(count: number) {
  const questions = Array.from({ length: count }, (_, i) => makeQuestion(`q${i + 1}`));
  useQuestionBankStore.setState({ questionsByWorld: { [WORLD]: questions } });
  return questions;
}

describe('useQuestionBankStore', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useQuestionBankStore.setState({
      questionsByWorld: {},
      fetchedKeyByWorld: {},
      fetchStatus: {},
      answers: [],
      remoteProgress: {},
    });
  });

  describe('recordAnswer', () => {
    it('records a new answer', () => {
      useQuestionBankStore.getState().recordAnswer(UID, 'q1', WORLD, true);
      const { answers } = useQuestionBankStore.getState();
      expect(answers).toHaveLength(1);
      expect(answers[0]).toMatchObject({
        uid: UID,
        questionId: 'q1',
        worldId: WORLD,
        isCorrect: true,
      });
    });

    it('re-answering the same questionId replaces, does not duplicate', () => {
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, false);
      store.recordAnswer(UID, 'q1', WORLD, true);
      const { answers } = useQuestionBankStore.getState();
      expect(answers).toHaveLength(1);
      expect(answers[0].isCorrect).toBe(true);
    });

    it('keeps separate entries for the same questionId across different uids', () => {
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      store.recordAnswer('other-uid', 'q1', WORLD, false);
      expect(useQuestionBankStore.getState().answers).toHaveLength(2);
    });
  });

  describe('getWorldProgress — local answers only', () => {
    it('done = count of correct answers, total = fetched questions length', () => {
      seedQuestions(4);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      store.recordAnswer(UID, 'q2', WORLD, true);
      store.recordAnswer(UID, 'q3', WORLD, false);
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD)).toEqual({
        done: 2,
        total: 4,
      });
    });

    it("does not count another user's correct answers", () => {
      seedQuestions(3);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      store.recordAnswer('other-uid', 'q2', WORLD, true);
      store.recordAnswer('other-uid', 'q3', WORLD, true);
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD)).toEqual({
        done: 1,
        total: 3,
      });
    });

    it('total is 0 when no questions have been fetched', () => {
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD)).toEqual({
        done: 0,
        total: 0,
      });
    });

    it(`in-progress quiz reports total = ${QUESTIONS_PER_WORLD} when 10 questions are fetched`, () => {
      seedQuestions(QUESTIONS_PER_WORLD);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD).total).toBe(
        QUESTIONS_PER_WORLD
      );
    });
  });

  describe('getWorldProgress — remote progress only', () => {
    it('done = round(mastery * total)', () => {
      seedQuestions(4);
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 0.5 });
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD)).toEqual({
        done: 2,
        total: 4,
      });
    });

    it('rounds mastery to nearest whole question', () => {
      seedQuestions(3);
      // 0.5 * 3 = 1.5 -> rounds to 2
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 0.5 });
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD).done).toBe(2);
    });

    it('full remote mastery yields done = total', () => {
      seedQuestions(5);
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 1 });
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD)).toEqual({
        done: 5,
        total: 5,
      });
    });

    it('remote mastery contributes 0 when no questions are fetched (total 0)', () => {
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 1 });
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD)).toEqual({
        done: 0,
        total: 0,
      });
    });
  });

  describe('getWorldProgress — local AND remote combined (max, never sum)', () => {
    it('uses max(localDone, remoteDone) and never their sum', () => {
      seedQuestions(4);
      const store = useQuestionBankStore.getState();
      // local: 1 correct
      store.recordAnswer(UID, 'q1', WORLD, true);
      // remote: 0.75 * 4 = 3
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 0.75 });
      const { done, total } = useQuestionBankStore.getState().getWorldProgress(UID, WORLD);
      expect(total).toBe(4);
      expect(done).toBe(3); // max(1, 3), NOT 1 + 3 = 4
    });

    it('local wins when it is ahead of remote', () => {
      seedQuestions(4);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      store.recordAnswer(UID, 'q2', WORLD, true);
      store.recordAnswer(UID, 'q3', WORLD, true);
      // remote: 0.25 * 4 = 1
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 0.25 });
      const { done } = useQuestionBankStore.getState().getWorldProgress(UID, WORLD);
      expect(done).toBe(3); // max(3, 1)
    });

    it('clamps combined done to total', () => {
      seedQuestions(2);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      store.recordAnswer(UID, 'q2', WORLD, true);
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 1 });
      expect(useQuestionBankStore.getState().getWorldProgress(UID, WORLD).done).toBe(2);
    });
  });

  describe('getAnsweredIds', () => {
    it('returns set of correctly answered questionIds for the uid', () => {
      seedQuestions(3);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      store.recordAnswer(UID, 'q2', WORLD, false);
      const ids = useQuestionBankStore.getState().getAnsweredIds(UID, WORLD);
      expect(ids.has('q1')).toBe(true);
      expect(ids.has('q2')).toBe(false);
      expect(ids.size).toBe(1);
    });
  });

  describe('isWorldComplete', () => {
    it('false below mastery threshold, true at/above it (mastery-based, not 100%)', () => {
      seedQuestions(2);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true); // 1/2 = 50% < 80%
      expect(useQuestionBankStore.getState().isWorldComplete(UID, WORLD)).toBe(false);
      useQuestionBankStore.getState().recordAnswer(UID, 'q2', WORLD, true); // 2/2 = 100%
      expect(useQuestionBankStore.getState().isWorldComplete(UID, WORLD)).toBe(true);
    });

    it('unlocks at the 80% mastery threshold without requiring every question', () => {
      seedQuestions(5);
      const store = useQuestionBankStore.getState();
      ['q1', 'q2', 'q3', 'q4'].forEach((q) => store.recordAnswer(UID, q, WORLD, true)); // 4/5 = 80%
      // done (4) < total (5), but the 80% mastery threshold is reached → complete.
      expect(useQuestionBankStore.getState().isWorldComplete(UID, WORLD)).toBe(true);
    });

    it('false when total is 0 even with no work to do', () => {
      expect(useQuestionBankStore.getState().isWorldComplete(UID, WORLD)).toBe(false);
    });

    it('true via remote progress alone', () => {
      seedQuestions(3);
      useQuestionBankStore.getState().setRemoteProgress({ [WORLD]: 1 });
      expect(useQuestionBankStore.getState().isWorldComplete(UID, WORLD)).toBe(true);
    });
  });

  describe('setRemoteProgress', () => {
    it('replaces the snapshot rather than merging', () => {
      const store = useQuestionBankStore.getState();
      store.setRemoteProgress({ world_1: 0.5, world_2: 0.5 });
      store.setRemoteProgress({ world_1: 1 });
      const { remoteProgress } = useQuestionBankStore.getState();
      expect(remoteProgress).toEqual({ world_1: 1 });
      expect(remoteProgress.world_2).toBeUndefined();
    });
  });

  describe('resetUserProgress', () => {
    it('clears both answers and remoteProgress', () => {
      seedQuestions(2);
      const store = useQuestionBankStore.getState();
      store.recordAnswer(UID, 'q1', WORLD, true);
      store.setRemoteProgress({ [WORLD]: 1 });
      useQuestionBankStore.getState().resetUserProgress();
      const s = useQuestionBankStore.getState();
      expect(s.answers).toEqual([]);
      expect(s.remoteProgress).toEqual({});
    });

    it('clears the assembled-question cache so the next student re-fetches', () => {
      seedQuestions(2);
      useQuestionBankStore.getState().resetUserProgress();
      expect(useQuestionBankStore.getState().questionsByWorld[WORLD]).toBeUndefined();
    });
  });

  describe('fetchWorldQuestions — cache guard keys on (grado, seedKey)', () => {
    const tenItems = Array.from({ length: 10 }, (_, i) => makeQuestion(`a${i}`));

    it('refetches when grado changes (does not serve the wrong grade — BLOQUEANTE-1)', async () => {
      mockFetch.mockResolvedValue(tenItems);
      const { fetchWorldQuestions } = useQuestionBankStore.getState();
      await fetchWorldQuestions('9', WORLD, 'uid-1');
      await fetchWorldQuestions('9', WORLD, 'uid-1'); // identical → deduped
      expect(mockFetch).toHaveBeenCalledTimes(1);
      await fetchWorldQuestions('11', WORLD, 'uid-1'); // grade changed → refetch
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith('11', WORLD, 'uid-1');
    });

    it('refetches when seedKey (student) changes so one student is not served another sample', async () => {
      mockFetch.mockResolvedValue(tenItems);
      const { fetchWorldQuestions } = useQuestionBankStore.getState();
      await fetchWorldQuestions('9', WORLD, 'uid-1');
      await fetchWorldQuestions('9', WORLD, 'uid-2'); // different student → refetch
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
