import { render } from '@testing-library/react-native';
import MiDineroScreen from './MiDineroScreen';
import ActividadScreen from './ActividadScreen';
import MetasScreen from './MetasScreen';

const mockSavingsState = {
  goals: [],
  operations: [],
  projection: () => ({ total: 0, unassigned: 0, byGoal: {} }),
  deleteGoal: jest.fn(),
  deleteOperation: jest.fn(),
};
const mockMovimientosState = { movimientos: [], deleteExpense: jest.fn() };

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    text: { primary: '#000', secondary: '#333', tertiary: '#666' },
    materials: { base: '#fff', border: '#ddd' },
    brand: { primary: '#00f' },
    system: { red: '#f00' },
  }),
}));
jest.mock(
  '@shared/components/ScreenWrapper',
  () =>
    ({ children }: { children: React.ReactNode }) => <>{children}</>
);
jest.mock('@shared/components/CetiButton', () => ({ label }: { label: string }) => <>{label}</>);
jest.mock('@features/savings/components/InsightCards', () => () => null);
jest.mock('@features/savings/components/PresupuestosSheet', () => () => null);
jest.mock('@features/savings/components/Segmented', () => () => null);
jest.mock('@features/savings/components/ActivityList', () => () => null);
jest.mock('@features/savings/components/ExpenseFormSheet', () => () => null);
jest.mock('@features/savings/components/SavingsOperationSheet', () => () => null);
jest.mock('@features/savings/components/GoalFormSheet', () => () => null);
jest.mock('@features/savings/icons/GoalIcon', () => ({ GoalIcon: () => null }));
jest.mock('@shared/lib/dialogs', () => ({ confirmAction: jest.fn() }));
jest.mock('@features/savings/store/useSavingsStore', () => ({
  useSavingsStore: (selector: (state: typeof mockSavingsState) => unknown) =>
    selector(mockSavingsState),
}));
jest.mock('@features/savings/store/useMovimientosStore', () => ({
  useMovimientosStore: (selector: (state: typeof mockMovimientosState) => unknown) =>
    selector(mockMovimientosState),
}));
jest.mock('@features/savings/store/usePresupuestosStore', () => ({
  usePresupuestosStore: (selector: (state: { topes: {} }) => unknown) => selector({ topes: {} }),
}));

test.each([
  ['Resumen', MiDineroScreen],
  ['Actividad', ActividadScreen],
  ['Metas', MetasScreen],
])('%s se renderiza con stores vacíos', (_name, Screen) => {
  expect(() => render(<Screen />)).not.toThrow();
});
