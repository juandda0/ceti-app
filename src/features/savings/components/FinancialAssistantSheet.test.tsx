import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { executeFinancialPlan } from '../assistant/executeFinancialPlan';
import type { FinancialPlan } from '../assistant/financialPlan';
import FinancialAssistantSheet from './FinancialAssistantSheet';

const mockExecute = executeFinancialPlan as jest.MockedFunction<typeof executeFinancialPlan>;

jest.mock('../assistant/executeFinancialPlan', () => ({ executeFinancialPlan: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number; value?: string }) =>
      key === 'financialAssistant.actionCount'
        ? `${values?.count} acciones`
        : key === 'financialAssistant.fields.monto'
          ? 'Monto'
          : key === 'financialAssistant.review.expense'
            ? 'Gasto'
            : key === 'financialAssistant.review.newGoal'
              ? 'Nueva meta'
          : key === 'financialAssistant.review.category'
            ? `Categoría: ${values?.value}`
            : key === 'financialAssistant.review.correct'
              ? 'Corregir'
              : key === 'movimientos.categorias.comida'
                ? 'Comida'
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
  goals: [] as { id: string; title: string }[],
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
  mockSavingsState.goals = [];
  mockExecute.mockResolvedValue([
    { actionId: 'r:0', status: 'success' },
    { actionId: 'r:1', status: 'error', reason: 'not_found' },
  ]);
});

it('permite corregir un ahorro para aportarlo a una meta', () => {
  mockSavingsState.goals = [{ id: 'goal_1', title: 'Viaje' }];
  const onChange = jest.fn();
  const savingPlan: FinancialPlan = {
    source: 'remote',
    actions: [
      {
        actionId: 's:0',
        domain: 'ahorro',
        operation: 'crear',
        needsInput: [],
        payload: { type: 'aporte', amount: 50000, description: 'Dinero encontrado', fecha: 10 },
      },
    ],
  };
  const view = render(
    <FinancialAssistantSheet visible plan={savingPlan} onChange={onChange} onClose={jest.fn()} />
  );

  fireEvent.press(view.getByText('Corregir'));
  fireEvent.press(view.getByRole('button', { name: 'financialAssistant.selectResource Viaje' }));

  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      actions: [expect.objectContaining({ payload: expect.objectContaining({ goalId: 'goal_1' }) })],
    })
  );
});

it('organiza una nueva meta y permite corregirla antes de confirmar', async () => {
  const goalPlan: FinancialPlan = {
    source: 'remote',
    actions: [
      {
        actionId: 'g:0',
        domain: 'meta',
        operation: 'crear',
        needsInput: [],
        payload: {
          title: 'Viaje',
          iconId: 'plane',
          category: 'trip',
          targetAmount: 500000,
        },
      },
    ],
  };
  const view = render(
    <FinancialAssistantSheet visible plan={goalPlan} onChange={jest.fn()} onClose={jest.fn()} />
  );

  expect(view.getByText('Nueva meta')).toBeTruthy();
  expect(view.queryByLabelText('financialAssistant.fields.title de Viaje')).toBeNull();

  fireEvent.press(view.getByText('Corregir'));
  fireEvent.changeText(view.getByLabelText('financialAssistant.fields.title de Viaje'), 'Viaje familiar');
  fireEvent.press(view.getByText('financialAssistant.confirm'));

  await waitFor(() => expect(mockExecute).toHaveBeenCalled());
  expect(mockExecute.mock.calls[0][0][0].payload).toEqual(
    expect.objectContaining({ title: 'Viaje familiar', targetAmount: 500000 })
  );
});

it('muestra la clasificación antes de abrir Corregir', () => {
  const view = render(
    <FinancialAssistantSheet visible plan={plan} onChange={jest.fn()} onClose={jest.fn()} />
  );

  expect(view.getAllByText('Gasto')).toHaveLength(1);
  expect(view.getByText('financialAssistant.review.deleteGoal')).toBeTruthy();
  expect(view.getByText('financialAssistant.review.destructiveWarning')).toBeTruthy();
  expect(view.getByText('Categoría: Comida')).toBeTruthy();
  expect(view.getByText('Corregir')).toBeTruthy();
  expect(view.queryByLabelText('Monto de Almuerzo')).toBeNull();
  expect(mockExecute).not.toHaveBeenCalled();

  fireEvent.press(view.getByText('Corregir'));
  expect(view.getByLabelText('Monto de Almuerzo')).toBeTruthy();
});

it('muestra el resumen, permite editar y solo ejecuta al confirmar', async () => {
  const onChange = jest.fn();
  const view = render(
    <FinancialAssistantSheet visible plan={plan} onChange={onChange} onClose={jest.fn()} />
  );

  expect(view.getByText('2 acciones')).toBeTruthy();
  expect(mockExecute).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Corregir'));
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

it('quita acciones durante Corregir y bloquea planes ambiguos', () => {
  const ambiguous: FinancialPlan = {
    source: 'remote',
    actions: [{ ...plan.actions[0], needsInput: ['monto'] }],
  };
  const view = render(
    <FinancialAssistantSheet visible plan={ambiguous} onChange={jest.fn()} onClose={jest.fn()} />
  );

  expect(view.getByRole('button', { name: 'financialAssistant.confirm' })).toBeDisabled();
  fireEvent.press(view.getByText('Corregir'));
  fireEvent.press(view.getByRole('button', { name: 'Quitar Almuerzo' }));
  expect(mockExecute).not.toHaveBeenCalled();
});

it('mantiene una fecha inválida pendiente y acepta una fecha calendario completa', () => {
  const view = render(
    <FinancialAssistantSheet visible plan={plan} onChange={jest.fn()} onClose={jest.fn()} />
  );
  fireEvent.press(view.getByText('Corregir'));
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
  await waitFor(() => expect(view.getByText('Almuerzo: $12.000')).toBeTruthy());
});

it('muestra un mensaje claro cuando el plan no tiene acciones y permite dictar de nuevo', () => {
  const onRedictate = jest.fn();
  const view = render(
    <FinancialAssistantSheet
      visible
      plan={{ source: 'remote', actions: [] }}
      onChange={jest.fn()}
      onClose={jest.fn()}
      onRedictate={onRedictate}
    />
  );
  expect(view.getByText('financialAssistant.emptyPlan')).toBeTruthy();
  expect(view.queryByText('0 acciones')).toBeNull();
  fireEvent.press(view.getByText('financialAssistant.redictate'));
  expect(onRedictate).toHaveBeenCalled();
});
