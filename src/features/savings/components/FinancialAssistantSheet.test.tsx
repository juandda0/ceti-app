import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { executeFinancialPlan } from '../assistant/executeFinancialPlan';
import type { FinancialPlan } from '../assistant/financialPlan';
import FinancialAssistantSheet from './FinancialAssistantSheet';

const mockExecute = executeFinancialPlan as jest.MockedFunction<typeof executeFinancialPlan>;

jest.mock('../assistant/executeFinancialPlan', () => ({ executeFinancialPlan: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      key === 'financialAssistant.actionCount'
        ? `${values?.count} acciones`
        : key === 'financialAssistant.fields.monto'
          ? 'Monto'
          : key,
  }),
}));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    background: { primary: '#111' },
    materials: { base: '#222', border: '#444', highlight: '#333' },
    text: { primary: '#fff', secondary: '#ddd', tertiary: '#aaa' },
    system: { red: '#f00', green: '#0f0' },
    brand: { primary: '#80f' },
  }),
}));
jest.mock('@shared/components/CetiBottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return function MockBottomSheet({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  };
});
jest.mock('@shared/components/CetiButton', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return function MockButton({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    );
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockCreateExpense = jest.fn();
const mockSavingsState = {
  goals: [],
  operations: [],
  createGoal: jest.fn(),
  updateGoal: jest.fn(),
  deleteGoal: jest.fn(),
  createOperation: jest.fn(),
  updateOperation: jest.fn(),
  deleteOperation: jest.fn(),
  projection: jest.fn(),
};
jest.mock('../store/useMovimientosStore', () => ({
  MOVIMIENTO_CATEGORIAS: ['comida', 'otros'],
  useMovimientosStore: (selector: (state: object) => unknown) =>
    selector({
      movimientos: [],
      createExpense: mockCreateExpense,
      updateExpense: jest.fn(),
      deleteExpense: jest.fn(),
    }),
}));
jest.mock('../store/useSavingsStore', () => ({
  useSavingsStore: (selector: (state: object) => unknown) => selector(mockSavingsState),
}));

const plan: FinancialPlan = {
  source: 'remote',
  actions: [
    {
      actionId: 'r:0',
      domain: 'movimiento',
      operation: 'crear',
      needsInput: [],
      payload: {
        tipo: 'gasto',
        monto: 12000,
        descripcion: 'Almuerzo',
        categoria: 'comida',
        fecha: 10,
      },
    },
    {
      actionId: 'r:1',
      domain: 'meta',
      operation: 'eliminar',
      resourceId: 'goal_1',
      payload: {},
      needsInput: [],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockResolvedValue([
    { actionId: 'r:0', status: 'success' },
    { actionId: 'r:1', status: 'error', reason: 'not_found' },
  ]);
});

it('muestra el resumen, permite editar y solo ejecuta al confirmar', async () => {
  const onChange = jest.fn();
  const view = render(
    <FinancialAssistantSheet visible plan={plan} onChange={onChange} onClose={jest.fn()} />
  );

  expect(view.getByText('2 acciones')).toBeTruthy();
  expect(mockExecute).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText('Monto de Almuerzo'), '15000');
  fireEvent.press(view.getByText('financialAssistant.confirm'));

  await waitFor(() => expect(mockExecute).toHaveBeenCalled());
  expect(mockExecute.mock.calls[0][0][0].payload).toEqual(
    expect.objectContaining({ monto: 15000 })
  );
  expect(onChange).toHaveBeenCalled();
  expect(view.getByText('financialAssistant.resultSuccess')).toBeTruthy();
  expect(view.getByText('financialAssistant.resultError')).toBeTruthy();
});

it('quita acciones, cancela sin ejecutar y bloquea planes ambiguos', () => {
  const onClose = jest.fn();
  const ambiguous: FinancialPlan = {
    source: 'remote',
    actions: [{ ...plan.actions[0], needsInput: ['monto'] }],
  };
  const view = render(
    <FinancialAssistantSheet visible plan={ambiguous} onChange={jest.fn()} onClose={onClose} />
  );

  expect(view.getByRole('button', { name: 'financialAssistant.confirm' })).toBeDisabled();
  fireEvent.press(view.getByRole('button', { name: 'Quitar Almuerzo' }));
  fireEvent.press(view.getByText('financialAssistant.cancel'));
  expect(mockExecute).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('mantiene una fecha inválida pendiente y acepta una fecha calendario completa', () => {
  const view = render(
    <FinancialAssistantSheet visible plan={plan} onChange={jest.fn()} onClose={jest.fn()} />
  );
  const input = view.getByLabelText('financialAssistant.fields.fecha de Almuerzo');

  fireEvent.changeText(input, '2026-0');
  fireEvent(input, 'blur');
  expect(view.getByRole('button', { name: 'financialAssistant.confirm' })).toBeDisabled();

  fireEvent.changeText(
    view.getByLabelText('financialAssistant.fields.fecha de Almuerzo'),
    '2026-08-30'
  );
  fireEvent(view.getByLabelText('financialAssistant.fields.fecha de Almuerzo'), 'blur');
  expect(view.getByRole('button', { name: 'financialAssistant.confirm' })).toBeEnabled();
});

it('muestra los datos devueltos por una consulta', async () => {
  mockExecute.mockResolvedValueOnce([
    {
      actionId: 'r:0',
      status: 'success',
      data: { movements: [{ descripcion: 'Almuerzo', monto: 12000 }] },
    },
  ]);
  const queryPlan: FinancialPlan = {
    source: 'remote',
    actions: [
      {
        actionId: 'r:0',
        domain: 'movimiento',
        operation: 'consultar',
        payload: {},
        needsInput: [],
      },
    ],
  };
  const view = render(
    <FinancialAssistantSheet visible plan={queryPlan} onChange={jest.fn()} onClose={jest.fn()} />
  );
  fireEvent.press(view.getByText('financialAssistant.confirm'));
  await waitFor(() => expect(view.getByText('Almuerzo: 12000')).toBeTruthy());
});
