import { objectMove, orderedKeys, type Positions } from './reorder';

const seed = (ids: string[]): Positions => Object.fromEntries(ids.map((id, i) => [id, i]));

describe('objectMove', () => {
  it('swaps the items at two slots', () => {
    const p = seed(['a', 'b', 'c']); // a:0 b:1 c:2
    const moved = objectMove(p, 0, 2); // swap slots 0 and 2
    expect(orderedKeys(moved)).toEqual(['c', 'b', 'a']);
  });

  it('is a no-op when from === to', () => {
    const p = seed(['a', 'b', 'c']);
    expect(orderedKeys(objectMove(p, 1, 1))).toEqual(['a', 'b', 'c']);
  });

  it('dragging one row down step by step lands it in the new slot', () => {
    // Simulate the gesture crossing slots one at a time: move "a" from 0 → 2.
    let p = seed(['a', 'b', 'c', 'd']);
    p = objectMove(p, 0, 1); // a crosses into slot 1
    p = objectMove(p, 1, 2); // a crosses into slot 2
    expect(orderedKeys(p)).toEqual(['b', 'c', 'a', 'd']);
  });
});
