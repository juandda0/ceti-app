const mockConfigure = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { googleWebClientId: 'client-id' } } }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: mockConfigure },
  isErrorWithCode: () => false,
  statusCodes: {},
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithPopup: jest.fn(),
  signInWithRedirect: jest.fn(),
}));
jest.mock('@shared/lib/firebase/app', () => ({ getFirebaseClients: jest.fn() }));

test('no configura el módulo nativo de Google en web', () => {
  const { configureGoogleSignIn } = require('./oauth');

  configureGoogleSignIn();

  expect(mockConfigure).not.toHaveBeenCalled();
});
