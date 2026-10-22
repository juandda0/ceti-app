import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSignIn = jest.fn();
const mockCreate = jest.fn();
const mockSetIntent = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@shared/lib/firebase/app', () => ({ isFirebaseConfigured: () => true }));
jest.mock('@shared/lib/firebase/emailAuth', () => ({
  signInWithEmail: (...args: unknown[]) => mockSignIn(...args),
  createAccountWithEmail: (...args: unknown[]) => mockCreate(...args),
}));
jest.mock('@features/auth/data/loginIntent', () => ({
  loginIntent: { set: (...args: unknown[]) => mockSetIntent(...args) },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock(
  '@shared/components/ScreenWrapper',
  () =>
    function MockScreenWrapper({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    }
);

// eslint-disable-next-line import/first -- los jest.mock deben ir antes del import.
import LoginScreen from './LoginScreen';

beforeEach(() => {
  jest.clearAllMocks();
});

function llenar() {
  fireEvent.changeText(screen.getByLabelText('loginCorreo.correo'), 'profe1@prueba.ceti');
  fireEvent.changeText(screen.getByLabelText('loginCorreo.clave'), 'secreto1');
}

test('entra con correo como profesor y vuelve al resolver', async () => {
  render(<LoginScreen />);
  fireEvent.press(screen.getByLabelText('roleChooser.profesor'));
  llenar();
  fireEvent.press(screen.getByLabelText('loginCorreo.entrar'));

  await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('profe1@prueba.ceti', 'secreto1'));
  expect(mockSetIntent).toHaveBeenCalledWith('profesor');
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('crea una cuenta de prueba como estudiante por defecto', async () => {
  render(<LoginScreen />);
  llenar();
  fireEvent.press(screen.getByLabelText('loginCorreo.crear'));

  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  expect(mockSetIntent).toHaveBeenCalledWith('estudiante');
});

test('sin correo ni contraseña avisa y no intenta entrar', () => {
  render(<LoginScreen />);
  fireEvent.press(screen.getByLabelText('loginCorreo.entrar'));

  expect(screen.getByText('loginCorreo.faltan')).toBeTruthy();
  expect(mockSignIn).not.toHaveBeenCalled();
});

test('muestra el error de Firebase', async () => {
  mockSignIn.mockRejectedValueOnce(new Error('Correo o contraseña incorrectos.'));
  render(<LoginScreen />);
  llenar();
  fireEvent.press(screen.getByLabelText('loginCorreo.entrar'));

  expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});
