import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockSetProfile = jest.fn();
const mockLogin = jest.fn();
const mockConfigurar = jest.fn();
const mockCompletar = jest.fn(() => ({ xp: 16, cetis: 20 }));
const mockRefrescarAvisos = jest.fn();
const mockPedirPermiso = jest.fn(async () => true);
const mockEventos = { metaElegida: jest.fn(), avisosConfigurados: jest.fn() };
const mockUser = { id: 'local-1' };

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
        'orbita.onboarding.despegar': '¡A volar!',
        'orbita.onboarding.activarAvisos': 'Activar avisos de Ceti',
        'orbita.onboarding.horaMas': 'Una hora después',
      })[key] ?? key,
  }),
}));
jest.mock('@shared/lib/firebase/app', () => ({ isFirebaseConfigured: () => false }));
jest.mock('@features/auth/data/userRepository', () => ({
  userRepository: { upsertProfile: jest.fn() },
}));
jest.mock('@features/dashboard/data/joinClass', () => ({ joinClass: jest.fn() }));
jest.mock('@features/dashboard/data/pendingInvite', () => ({
  pendingInvite: { consume: jest.fn() },
}));
jest.mock('@features/auth/store/useUserStore', () => ({
  useUserStore: Object.assign(
    (selector: (state: { setProfile: typeof mockSetProfile }) => unknown) =>
      selector({ setProfile: mockSetProfile }),
    { getState: () => mockUser, setState: jest.fn() }
  ),
}));
jest.mock('@features/orbita/store/useOrbitaStore', () => ({
  useOrbitaStore: {
    getState: () => ({
      configurar: mockConfigurar,
      completar: mockCompletar,
      porUid: { 'local-1': { ajustes: {} } },
    }),
  },
}));
jest.mock('@features/orbita/hooks/useOrbita', () => ({
  refrescarAvisos: (e: unknown) => mockRefrescarAvisos(e),
}));
jest.mock('@features/orbita/data/avisosCeti', () => ({
  pedirPermisoAvisos: () => mockPedirPermiso(),
}));
jest.mock('@features/orbita/data/eventos', () => ({
  eventos: {
    metaElegida: (p: object) => mockEventos.metaElegida(p),
    avisosConfigurados: (p: object) => mockEventos.avisosConfigurados(p),
  },
}));
jest.mock('@features/orbita/components/PuenteDeMando', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SelectorMeta: ({ onElegir }: { onElegir: (m: string) => void }) => (
      <Pressable accessibilityRole="button" onPress={() => onElegir('orbita')}>
        <Text>Meta órbita</Text>
      </Pressable>
    ),
  };
});
jest.mock('@features/learning/screens/LeccionScreen', () => {
  const { Pressable, Text } = require('react-native');
  return function MockLeccionScreen({
    modo,
    items,
    onSalir,
    onTerminar,
  }: {
    modo: string;
    items: { id: string }[];
    onSalir: () => void;
    onTerminar: (r: object) => void;
  }) {
    return (
      <>
        <Text>{`Lección ${modo} (${items.length})`}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            onTerminar({
              total: 3,
              acertadasALaPrimera: 3,
              errores: 0,
              xpRespuestas: 6,
              perfecta: true,
              idsAcertadas: [],
            })
          }
        >
          <Text>Terminar vuelo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSalir}>
          <Text>Salir del vuelo</Text>
        </Pressable>
      </>
    );
  };
});
jest.mock('@features/orbita/components/FinLeccion', () => {
  const { Pressable, Text } = require('react-native');
  return function MockFinLeccion({ modo, onContinuar }: { modo: string; onContinuar: () => void }) {
    return (
      <Pressable accessibilityRole="button" onPress={onContinuar}>
        <Text>{`Fin ${modo}`}</Text>
      </Pressable>
    );
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
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
jest.mock(
  '@shared/components/ScreenWrapper',
  () =>
    function MockScreenWrapper({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    }
);
jest.mock(
  '@shared/components/PageHeader',
  () =>
    function MockPageHeader({ title }: { title: string }) {
      return <>{title}</>;
    }
);
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
jest.mock('@shared/components/Bounceable', () => {
  const { Pressable } = require('react-native');
  return function MockBounceable({ children, ...props }: { children: React.ReactNode }) {
    return <Pressable {...props}>{children}</Pressable>;
  };
});
jest.mock(
  '@features/dashboard/components/ClassCodeForm',
  () =>
    function MockClassCodeForm() {
      return <>Código de clase</>;
    }
);
jest.mock(
  '@features/avatar/components/AvatarView',
  () =>
    function MockAvatarView() {
      return null;
    }
);

import UserSetupScreen from './UserSetupScreen';

beforeEach(() => jest.clearAllMocks());

function hastaElVuelo() {
  fireEvent.changeText(screen.getByPlaceholderText('Tu nombre...'), 'Ana');
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sofi' }));
  fireEvent.press(screen.getByRole('button', { name: 'avatar.tonoPiel: avatar.tono.morena' }));
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
}

test('nombre, tripulante, meta, hora y avisos, primer vuelo con recompensa y bienvenida', async () => {
  render(<UserSetupScreen />);

  hastaElVuelo();
  fireEvent.press(screen.getByRole('button', { name: 'Meta órbita' }));
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  expect(mockEventos.metaElegida).toHaveBeenCalledWith({ meta: 'orbita' });

  fireEvent.press(screen.getByRole('button', { name: 'Una hora después' }));
  fireEvent.press(screen.getByRole('button', { name: 'Activar avisos de Ceti' }));
  await waitFor(() => expect(screen.getByText('orbita.onboarding.avisosActivos')).toBeTruthy());
  expect(mockPedirPermiso).toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: '¡A volar!' }));
  expect(mockEventos.avisosConfigurados).toHaveBeenCalledWith({ activos: true, hora: 19 });

  expect(screen.getByText('Lección primer_vuelo (3)')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Terminar vuelo' }));
  expect(mockConfigurar).toHaveBeenCalledWith('local-1', {
    meta: 'orbita',
    horaAviso: 19,
    avisos: true,
  });
  expect(mockCompletar).toHaveBeenCalledWith('local-1', {
    tipo: 'primer_vuelo',
    xpRespuestas: 6,
    perfecta: true,
  });

  fireEvent.press(screen.getByRole('button', { name: 'Fin primer_vuelo' }));
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(mockRefrescarAvisos).toHaveBeenCalledWith({ ajustes: {} });
  expect(mockSetProfile).toHaveBeenCalledWith('Ana', 'Ana', {
    personaje: 'sofi',
    tono: 'morena',
    pelo: 'original',
    prenda: 'traje',
    accesorio: null,
  });
  expect(screen.queryByText('Código de clase')).toBeNull();
});

test('se puede saltar el primer vuelo sin avisos ni recompensa', async () => {
  render(<UserSetupScreen />);

  hastaElVuelo();
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.press(screen.getByRole('button', { name: '¡A volar!' }));
  expect(mockEventos.metaElegida).toHaveBeenCalledWith({ meta: 'crucero' });
  expect(mockEventos.avisosConfigurados).toHaveBeenCalledWith({ activos: false, hora: 18 });

  fireEvent.press(screen.getByRole('button', { name: 'Salir del vuelo' }));
  expect(mockCompletar).not.toHaveBeenCalled();
  expect(mockConfigurar).toHaveBeenCalledWith('local-1', {
    meta: 'crucero',
    horaAviso: 18,
    avisos: false,
  });

  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});
