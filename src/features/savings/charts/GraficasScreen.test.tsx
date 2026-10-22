import { act, fireEvent, render } from '@testing-library/react-native';
import GraficasScreen from '../../../../app/(app)/graficas';

const DIA = 24 * 60 * 60 * 1000;
const mockState: { movimientos: unknown[]; goals: unknown[]; operations: unknown[] } = {
  movimientos: [],
  goals: [],
  operations: [],
};

jest.mock('@features/animations', () => ({ CetiAnimation: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key),
  }),
}));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => jest.requireActual('@shared/constants/colors').DarkColors,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
jest.mock(
  '@shared/components/ScreenWrapper',
  () =>
    ({ children }: { children: unknown }) =>
      children
);
jest.mock('@features/savings/store/useMovimientosStore', () => ({
  useMovimientosStore: (selector: (s: object) => unknown) => selector(mockState),
}));
jest.mock('@features/savings/store/useSavingsStore', () => ({
  useSavingsStore: (selector: (s: object) => unknown) => selector(mockState),
}));

function mov(id: string, monto: number, fecha: number, categoria = 'comida') {
  return {
    id,
    tipo: 'gasto',
    monto,
    descripcion: 'x',
    categoria,
    origen: 'voz',
    createdAt: fecha,
    fecha,
  };
}

describe('GraficasScreen', () => {
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });
  beforeEach(() => {
    jest.useFakeTimers();
    mockState.movimientos = [];
    mockState.goals = [];
    mockState.operations = [];
  });

  it('muestra el estado vacío amigable sin datos', () => {
    const { getByText } = render(<GraficasScreen />);
    expect(getByText('graficasSeccion.vacioTitulo')).toBeTruthy();
    expect(getByText('graficasSeccion.metas.vacio')).toBeTruthy();
  });

  it('renderiza con datos, montos enormes y metas borradas, y cambia de periodo', () => {
    const now = Date.now();
    mockState.movimientos = [
      mov('a', 5000, now),
      mov('b', 99_000_000, now - DIA, 'tecnologia'),
      mov('c', 1, now - 40 * DIA, 'ropa'),
    ];
    mockState.goals = [
      { id: 'g1', title: 'Bici', targetAmount: 100000, createdAt: now, deletedAt: undefined },
      { id: 'g2', title: 'Borrada', targetAmount: 100, createdAt: now, deletedAt: now },
      { id: 'g3', title: 'Cero', targetAmount: 0, createdAt: now },
    ];
    mockState.operations = [
      {
        id: 'o1',
        type: 'aporte',
        amount: 30000,
        description: '',
        goalId: 'g1',
        fecha: now,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const screen = render(<GraficasScreen />);
    expect(screen.queryByText('Borrada')).toBeNull();
    expect(screen.getByText('Bici')).toBeTruthy();
    expect(screen.getByText('graficasSeccion.categorias.titulo')).toBeTruthy();

    // Mide el contenedor para que se dibuje el SVG y toca una columna.
    act(() => {
      fireEvent(screen.getByTestId('graficas-time-chart'), 'layout', {
        nativeEvent: { layout: { width: 300, height: 170, x: 0, y: 0 } },
      });
    });
    act(() => {
      fireEvent.press(
        screen.getAllByRole('button', { name: /graficasSeccion\.tiempo\.detalle/ })[0]
      );
    });
    // Tocar una categoría muestra su detalle.
    act(() => {
      fireEvent.press(
        screen.getAllByRole('button', { name: /^Tecnolog|movimientos\.categorias\.tecnologia/ })[0]
      );
    });
    expect(screen.getByText(/graficasSeccion\.categorias\.detalle/)).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByLabelText('graficasSeccion.periodo.todo'));
    });
    expect(screen.getByText('graficasSeccion.tiempo.titulo_todo')).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByLabelText('graficasSeccion.periodo.mes'));
    });
    expect(screen.getByText('graficasSeccion.tiempo.titulo_mes')).toBeTruthy();
  });
});
