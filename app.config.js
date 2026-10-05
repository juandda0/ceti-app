/**
 * Configuración Expo: extiende app.json con variables de entorno (backend, EAS, OAuth).
 * @param {{ config?: import('expo/config').ExpoConfig }} ctx
 */
/** Enlazado con EAS (@juanndda/ceti). Sustituir con env solo si cambias de proyecto. */
const EAS_PROJECT_ID = 'c1975a63-85c8-48e0-8640-1ca3a9565b9d';

const appJson = require('./app.json');

/**
 * EAS/Metro a veces invoca esta config con un `config` parcial; si no fusionamos con
 * app.json, se pierden `runtimeVersion` / `updates` y falla con:
 * "Cannot read properties of undefined (reading 'policy')".
 */
module.exports = ({ config } = {}) => {
  const expo = { ...appJson.expo, ...(config || {}) };

  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || '';

  const basePlugins = Array.isArray(expo.plugins) ? expo.plugins : [];

  const nativePlugins = [
    ...basePlugins,
    './plugins/withAndroidMainActivitySingleTask.js',
    ['expo-build-properties', { android: { minSdkVersion: 24 } }],
  ];

  // Google Sign-In sin Firebase: Android solo necesita el Web client ID en
  // runtime; iOS necesita el URL scheme del OAuth client iOS.
  if (googleIosUrlScheme) {
    nativePlugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: googleIosUrlScheme },
    ]);
  }

  return {
    ...expo,
    plugins: nativePlugins,
    ios: {
      ...(expo.ios || {}),
      bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.juanndda.ceti',
    },
    extra: {
      ...(expo.extra || {}),
      eas: {
        ...(expo.extra?.eas || {}),
        projectId: process.env.EAS_PROJECT_ID || expo.extra?.eas?.projectId || EAS_PROJECT_ID,
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
      devLogin: process.env.EXPO_PUBLIC_DEV_LOGIN === '1',
      pinPepper: process.env.EXPO_PUBLIC_PIN_PEPPER || '',
      privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '',
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
      googleIosUrlScheme,
    },
  };
};
