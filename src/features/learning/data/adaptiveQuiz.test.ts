import {
  targetDifficulty,
  selectNextQuestion,
  type AnswerResult,
} from '@features/learning/data/adaptiveQuiz';

const C = (difficulty: AnswerResult['difficulty'], correct: boolean): AnswerResult => ({
  difficulty,
  correct,
});

describe('targetDifficulty', () => {
  it('starts at basic with no history', () => {
    expect(targetDifficulty([])).toBe('basic');
  });

  it('ramps up one rung per 2-correct streak', () => {
    expect(targetDifficulty([C('basic', true), C('basic', true)])).toBe('intermediate');
    expect(
      targetDifficulty([
        C('basic', true),
        C('basic', true),
        C('intermediate', true),
        C('intermediate', true),
      ])
    ).toBe('advanced');
  });

  it('a single correct is not enough to ramp', () => {
    expect(targetDifficulty([C('basic', true)])).toBe('basic');
  });

  it('drops a rung on a wrong answer', () => {
    // up to intermediate, then a miss → back to basic
    expect(targetDifficulty([C('basic', true), C('basic', true), C('intermediate', false)])).toBe(
      'basic'
    );
  });

  it('never exceeds advanced or drops below basic', () => {
    expect(targetDifficulty(Array.from({ length: 10 }, () => C('advanced', true)))).toBe(
      'advanced'
    );
    expect(targetDifficulty([C('basic', false), C('basic', false)])).toBe('basic');
  });
});

describe('selectNextQuestion', () => {
  const qs = [
    { id: 'b1', difficulty: 'basic' as const },
    { id: 'b2', difficulty: 'basic' as const },
    { id: 'i1', difficulty: 'intermediate' as const },
    { id: 'a1', difficulty: 'advanced' as const },
  ];

  it('prefers a question at the target difficulty', () => {
    // streak of 2 correct → target intermediate
    const next = selectNextQuestion(qs, new Set(), [C('basic', true), C('basic', true)]);
    expect(next?.id).toBe('i1');
  });

  it('starts with a basic question (target basic, easier-first)', () => {
    const next = selectNextQuestion(qs, new Set(), []);
    expect(next?.difficulty).toBe('basic');
  });

  it('skips consumed questions', () => {
    const next = selectNextQuestion(qs, new Set(['b1', 'b2']), []);
    // no basics left; nearest to target(basic) is intermediate
    expect(next?.id).toBe('i1');
  });

  it('falls back to the nearest available rung when target is missing', () => {
    // target advanced, but only basic/intermediate remain → nearest is intermediate
    const next = selectNextQuestion(
      [
        { id: 'b1', difficulty: 'basic' as const },
        { id: 'i1', difficulty: 'intermediate' as const },
      ],
      new Set(),
      [C('basic', true), C('basic', true), C('intermediate', true), C('intermediate', true)]
    );
    expect(next?.id).toBe('i1');
  });

  it('returns null when everything is consumed', () => {
    expect(selectNextQuestion(qs, new Set(['b1', 'b2', 'i1', 'a1']), [])).toBeNull();
  });
});
