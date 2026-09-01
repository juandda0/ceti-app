import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSignInWithGoogle = jest.fn();
const mockSetIntent = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    background: { base: '#fff' },
    brand: { primary: '#000' },
    text: { primary: '#000', tertiary: '#666' },
    system: { red: '#f00' },
    materials: { border: '#ddd' },
  }),
}));
jest.mock('@shared/store/useThemeStore', () => ({
  useThemeStore: (selector: (state: { mode: string }) => unknown) => selector({ mode: 'light' }),
}));
jest.mock('@shared/lib/firebase/app', () => ({ isFirebaseConfigured: () => true }));
jest.mock('@shared/lib/firebase/oauth', () => ({
  configureGoogleSignIn: jest.fn(),
  isAppleSignInAvailable: () => false,
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInWithApple: jest.fn(),
}));
jest.mock('@features/auth/data/loginIntent', () => ({
  loginIntent: { set: (...args: unknown[]) => mockSetIntent(...args) },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@shared/components/ScreenWrapper', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('@shared/components/PageHeader', () => ({ title }: { title: string }) => <>{title}</>);
jest.mock('@shared/components/CetiButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
});
jest.mock('@shared/components/CetiBottomSheet', () => ({
  children,
  visible,
}: {
  children: React.ReactNode;
  visible: boolean;
}) => (visible ? <>{children}</> : null));

import LoginScreen from './LoginScreen';

test('inicia Google como visitante sin abrir selector de rol', async () => {
  render(<LoginScreen />);

  fireEvent.press(screen.getByRole('button', { name: 'Entrar como invitado' }));

  await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
  expect(mockSetIntent).toHaveBeenCalledWith('estudiante');
  expect(screen.queryByText('¿Cómo usarás Ceti?')).toBeNull();
});
