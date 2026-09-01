import { fireEvent, render } from '@testing-library/react-native';
import FloatingVoiceButton from './FloatingVoiceButton';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({ brand: { primary: '#00f' }, text: { onBrand: '#fff' } }),
}));

test('abre el registro por voz desde un botón accesible', () => {
  const view = render(<FloatingVoiceButton />);

  fireEvent.press(view.getByRole('button', { name: 'financialVoice.open' }));

  expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith('/(app)/movimientos');
});
