import { render } from '@testing-library/react-native';
import MiDineroScreen from './MiDineroScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    text: { primary: '#111', secondary: '#333', tertiary: '#666' },
    materials: { base: '#fff', border: '#ddd' },
    brand: { primary: '#00f' },
    system: { red: '#f00' },
  }),
}));
jest.mock('@shared/lib/dialogs', () => ({ confirmAction: jest.fn() }));
jest.mock('@shared/components/ScreenWrapper', () => {
  const { View } = require('react-native');
  return ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
});
jest.mock('@shared/components/CetiButton', () => {
  const { Text } = require('react-native');
  return ({ label }: { label: string }) => <Text>{label}</Text>;
});
jest.mock('@features/savings/components/Segmented', () => () => null);
jest.mock('@features/savings/components/ActivityList', () => () => null);
jest.mock('@features/savings/components/InsightCards', () => () => null);
jest.mock('@features/savings/components/GoalFormSheet', () => () => null);
jest.mock('@features/savings/components/ExpenseFormSheet', () => () => null);
jest.mock('@features/savings/components/SavingsOperationSheet', () => () => null);
jest.mock('@features/savings/components/PresupuestosSheet', () => () => null);
jest.mock('@features/savings/icons/GoalIcon', () => ({ GoalIcon: () => null }));

test('renderiza Mi dinero sin entrar en un ciclo de actualizaciones', () => {
  expect(() => render(<MiDineroScreen />)).not.toThrow();
});
