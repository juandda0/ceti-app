import { useWorldStore } from './useWorldStore';

describe('useWorldStore', () => {
  beforeEach(() => {
    useWorldStore.getState().resetWorld();
  });

  it('starts at rocky world with rocky unlocked', () => {
    const state = useWorldStore.getState();
    expect(state.currentWorldId).toBe('rocky');
    expect(state.unlockedWorldIds).toContain('rocky');
    expect(state.unlockedWorldIds).not.toContain('sprout');
  });

  it('unlockWorld adds new world to unlockedWorldIds', () => {
    useWorldStore.getState().unlockWorld('sprout');
    expect(useWorldStore.getState().unlockedWorldIds).toContain('sprout');
  });

  it('unlockWorld is idempotent (no duplicates)', () => {
    useWorldStore.getState().unlockWorld('sprout');
    useWorldStore.getState().unlockWorld('sprout');
    const ids = useWorldStore.getState().unlockedWorldIds;
    expect(ids.filter((id) => id === 'sprout')).toHaveLength(1);
  });

  it('travelTo changes currentWorldId and records history', () => {
    useWorldStore.getState().unlockWorld('sprout');
    useWorldStore.getState().travelTo('sprout');
    const state = useWorldStore.getState();
    expect(state.currentWorldId).toBe('sprout');
    expect(state.travelHistory.some((h) => h.worldId === 'sprout')).toBe(true);
  });

  it('resetWorld restores initial state', () => {
    useWorldStore.getState().unlockWorld('sprout');
    useWorldStore.getState().travelTo('sprout');
    useWorldStore.getState().resetWorld();
    const state = useWorldStore.getState();
    expect(state.currentWorldId).toBe('rocky');
    expect(state.unlockedWorldIds).toEqual(['rocky']);
    expect(state.travelHistory).toHaveLength(0);
  });
});
