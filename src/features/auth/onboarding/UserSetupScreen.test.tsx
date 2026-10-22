import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockSetProfile = jest.fn();
const mockLogin = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const animation: Record<string, unknown> = {
    duration: () => animation,
    delay: () => animation,
    easing: () => animation,
    withInitialValues: () => animation,
    reduceMotion: () => animation,
  };
  const easingFn = (t: number) => t;
  return {
    __esModule: true,
    default: { View },
    FadeIn: animation,
    FadeOut: animation,
    FadeInDown: animation,
    FadeInRight: animation,
    FadeOutLeft: animation,
    FadeInUp: animation,
    FadeOutUp: animation,
    ZoomIn: animation,
    Layout: animation,
    LinearTransition: animation,
    Keyframe: function Keyframe() {
      return animation;
    },
    Easing: { out: () => easingFn, quad: easingFn, cubic: easingFn, bezier: () => easingFn },
    ReduceMotion: { System: 'system' },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'onboarding.namePlaceholder': 'Tu nombre...',
        'onboarding.next': 'Siguiente',
        'onboarding.start': 'Comenzar',
      })[key] ?? key,
  }),
}));
jest.mock('@shared/lib/firebase/app', () => ({ isFirebaseConfigured: () => false }));
jest.mock('@features/auth/data/userRepository', () => ({ userRepository: { upsertProfile: jest.fn() } }));
jest.mock('@features/dashboard/data/joinClass', () => ({ joinClass: jest.fn() }));
jest.mock('@features/dashboard/data/pendingInvite', () => ({ pendingInvite: { consume: jest.fn() } }));
jest.mock('@features/auth/store/useUserStore', () => ({
  useUserStore: (selector: (state: { setProfile: typeof mockSetProfile }) => unknown) =>
    selector({ setProfile: mockSetProfile }),
}));
jest.mock('@features/auth/store/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ login: mockLogin }) },
}));
jest.mock('@shared/lib/analytics/logEvent', () => ({ logEvent: jest.fn() }));
jest.mock('@shared/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    brand: { primary: '#000' },
    fill: { brandSubtle: '#eee' },
    materials: { highlight: '#eee', base: '#fff', border: '#ddd' },
    background: { base: '#fff' },
    text: { primary: '#000', secondary: '#333', tertiary: '#666' },
    system: { red: '#f00' },
  }),
}));
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
jest.mock('@shared/components/Bounceable', () => {
  const { Pressable } = require('react-native');
  return ({ children, ...props }: { children: React.ReactNode }) => <Pressable {...props}>{children}</Pressable>;
});
jest.mock('@features/dashboard/components/ClassCodeForm', () => () => <>Código de clase</>);
jest.mock('@features/avatar/components/AvatarView', () => () => null);

import UserSetupScreen from './UserSetupScreen';

test('termina después de elegir nombre y tripulante sin pedir código', async () => {
  render(<UserSetupScreen />);

  fireEvent.changeText(screen.getByPlaceholderText('Tu nombre...'), 'Ana');
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sofi' }));
  fireEvent.press(screen.getByRole('button', { name: 'avatar.tonoPiel: avatar.tono.morena' }));
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(mockSetProfile).toHaveBeenCalledWith('Ana', 'Ana', {
    personaje: 'sofi',
    tono: 'morena',
    pelo: 'original',
    prenda: 'traje',
    accesorio: null,
  });
  expect(screen.queryByText('Código de clase')).toBeNull();
});
