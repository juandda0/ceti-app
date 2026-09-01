import { render } from '@testing-library/react-native';

const mockTabNames: string[] = [];

jest.mock('expo-router', () => ({
  Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <>{children}</>, {
    Screen: ({ name }: { name: string }) => {
      mockTabNames.push(name);
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

import AppTabLayout from './_layout';

test('registra exactamente las cinco pestañas financieras', () => {
  render(<AppTabLayout />);

  expect(mockTabNames).toEqual(['saga', 'dinero', 'actividad', 'metas', 'profile']);
});
