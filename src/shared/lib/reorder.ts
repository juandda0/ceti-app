/**
 * Pure helpers for ReorderableList's drag math. Kept RN-free so they can be
 * unit-tested directly. `objectMove` is a worklet (called from the Pan gesture
 * on the UI thread); the 'worklet' directive is a no-op under Jest.
 */
export type Positions = Record<string, number>;

/** Swap the items sitting at slots `from` and `to`. */
export function objectMove(positions: Positions, from: number, to: number): Positions {
  'worklet';
  const next: Positions = {};
  for (const id of Object.keys(positions)) {
    if (positions[id] === from) next[id] = to;
    else if (positions[id] === to) next[id] = from;
    else next[id] = positions[id];
  }
  return next;
}

/** Keys sorted by their slot — the committed order after a drag. */
export function orderedKeys(positions: Positions): string[] {
  return Object.keys(positions).sort((a, b) => positions[a] - positions[b]);
}
