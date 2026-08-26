import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { logEvent } from '@shared/lib/analytics/logEvent';
import ConfirmMovimientosListSheet from './ConfirmMovimientosListSheet';

const mockCreateExpense = jest.fn().mockResolvedValue({ ok: true });
const mockCreateOperation = jest.fn().mockResolvedValue({ ok: true });

jest.mock('@shared/lib/analytics/logEvent', () => ({ logEvent: jest.fn() }));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    materials: { border: '#000' },
    text: { primary: '#000', tertiary: '#666' },
    system: { green: '#0a0', red: '#a00' },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@shared/store/useCetiOverlayStore', () => ({ showCetiNotice: jest.fn() }));
jest.mock('@shared/components/CetiBottomSheet', () => {
  const { View } = require('react-native');
  return function MockCetiBottomSheet({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  };
});
jest.mock('@shared/components/CetiButton', () => {
  const { Pressable, Text } = require('react-native');
  return function MockCetiButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    );
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@features/savings/store/useMovimientosStore', () => ({
  useMovimientosStore: (
    selector: (state: { createExpense: typeof mockCreateExpense }) => unknown
  ) => selector({ createExpense: mockCreateExpense }),
}));
jest.mock('@features/savings/store/useSavingsStore', () => ({
  useSavingsStore: (
    selector: (state: { createOperation: typeof mockCreateOperation }) => unknown
  ) => selector({ createOperation: mockCreateOperation }),
}));

test('confirma varias filas sin enviar la cantidad a Analytics', async () => {
  const view = render(
    <ConfirmMovimientosListSheet
      visible
      items={[
        {
          intencion: 'movimiento',
          tipo: 'gasto',
          monto: 20000,
          descripcion: 'Mercado',
          categoria: 'comida',
          confianza: 1,
          offsetDias: 0,
        },
        {
          intencion: 'movimiento',
          tipo: 'ahorro',
          monto: 10000,
          descripcion: 'Alcancía',
          categoria: 'otros',
          confianza: 1,
          offsetDias: 0,
        },
      ]}
      onClose={jest.fn()}
    />
  );

  await view.findByDisplayValue('20.000');
  fireEvent.press(view.getByRole('button', { name: 'movimientos.confirmarTodos' }));

  await waitFor(() => expect(logEvent).toHaveBeenCalledWith('movimientos_multi_confirmado'));
  expect(logEvent).not.toHaveBeenCalledWith(
    'movimientos_multi_confirmado',
    expect.objectContaining({ cantidad: expect.anything() })
  );
});
