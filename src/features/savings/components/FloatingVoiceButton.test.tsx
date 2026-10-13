import { fireEvent, render } from '@testing-library/react-native';
import FloatingVoiceButton from './FloatingVoiceButton';

const mockStart = jest.fn();
const mockVoice = { state: 'idle' as string };

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({ brand: { primary: '#00f' }, text: { onBrand: '#fff' } }),
}));
jest.mock('@shared/store/useCetiOverlayStore', () => ({ showCetiToast: jest.fn() }));
jest.mock('@features/savings/hooks/useVoiceCapture', () => ({
  useVoiceCapture: () => ({
    state: mockVoice.state,
    transcript: '',
    start: mockStart,
    stop: jest.fn(),
    cancel: jest.fn(),
  }),
}));
jest.mock('@features/savings/data/vozService', () => ({ vozService: { planificar: jest.fn() } }));
jest.mock('@features/savings/store/useMovimientosStore', () => ({
  useMovimientosStore: (selector: (state: object) => unknown) => selector({ movimientos: [] }),
}));
jest.mock('@features/savings/store/useSavingsStore', () => ({
  useSavingsStore: (selector: (state: object) => unknown) =>
    selector({ goals: [], operations: [] }),
}));
jest.mock('@features/savings/components/FinancialAssistantSheet', () => () => null);
jest.mock('@features/savings/components/VoiceCaptureSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return function MockCapture({ visible }: { visible: boolean }) {
    return visible ? <Text>capture-open</Text> : null;
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVoice.state = 'idle';
});

test('empieza a escuchar de inmediato al tocar el botón flotante', () => {
  const view = render(<FloatingVoiceButton />);

  fireEvent.press(view.getByRole('button', { name: 'financialVoice.open' }));

  expect(mockStart).toHaveBeenCalledTimes(1);
});

test('sin reconocimiento de voz abre el modo escribir', () => {
  mockVoice.state = 'unavailable';
  const view = render(<FloatingVoiceButton />);

  fireEvent.press(view.getByRole('button', { name: 'financialVoice.open' }));

  expect(mockStart).not.toHaveBeenCalled();
  expect(view.getByText('capture-open')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'financialVoice.open' })).toBeNull();
});
