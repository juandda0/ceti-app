import { render } from '@testing-library/react-native';

const mockTabNames: string[] = [];
const mockTabOptions: Record<string, unknown> = {};

jest.mock('@features/avatar/hooks/useProgresoAvatar', () => ({ useVigilarDesbloqueos: () => {} }));
jest.mock('@features/dashboard/hooks/usePushCeti', () => ({ usePushCeti: () => {} }));
jest.mock('expo-router', () => ({
  Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <>{children}</>, {
    Screen: ({ name, options }: { name: string; options?: unknown }) => {
      mockTabNames.push(name);
      mockTabOptions[name] = options;
      return null;
    },
  }),
  useFocusEffect: jest.fn(),
  useRouter: () => ({}),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@shared/store/useThemeStore', () => ({
  useThemeStore: (selector: (state: { mode: 'light' }) => unknown) => selector({ mode: 'light' }),
}));
jest.mock('@shared/hooks/useThemeColors', () => ({ useThemeColors: () => ({}) }));
jest.mock('@shared/navigation/mainTabBarOptions', () => ({
  buildMainTabScreenOptions: () => ({}),
}));
jest.mock('@features/auth/performLogout', () => ({ performLogoutAndGo: jest.fn() }));
jest.mock('@features/savings/components/FloatingVoiceButton', () => () => null);

import AppTabLayout from './_layout';

test('registra las pestañas públicas de aprendizaje y finanzas', () => {
  render(<AppTabLayout />);

  const visibleTabs = mockTabNames.filter(
    (name) => (mockTabOptions[name] as { href?: unknown } | undefined)?.href !== null
  );
  expect(visibleTabs).toEqual(['saga', 'actividad', 'metas', 'graficas', 'profile']);
  expect(visibleTabs).not.toContain('staff');
});

test('oculta rutas auxiliares de la barra de pestañas', () => {
  render(<AppTabLayout />);

  expect(mockTabOptions).toMatchObject({
    dinero: { href: null },
    savings: { href: null },
    movimientos: { href: null },
    'app-tabs.test': { href: null },
  });
});
