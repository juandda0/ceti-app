import { useThemeStore } from './useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'dark' }));

  it('inicia en modo oscuro', () => {
    expect(useThemeStore.getInitialState().mode).toBe('dark');
  });

  it('mantiene la alternancia entre oscuro y claro', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('light');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('dark');
  });
});
