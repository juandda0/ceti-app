/**
 * Configuración Expo: extiende app.json con variables de entorno (Firebase, EAS, OAuth).
 * @param {{ config?: import('expo/config').ExpoConfig }} ctx
 */
module.exports = ({ config } = {}) => {
  const root = config?.expo ? config : require('./app.json');
  const expo = root.expo ?? {};

  const appleOn =
    process.env.EXPO_PUBLIC_FEATURE_APPLE_SIGNIN === '1' ||
    process.env.EXPO_PUBLIC_FEATURE_APPLE_SIGNIN === 'true';

  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || '';

  const basePlugins = Array.isArray(expo.plugins) ? expo.plugins : [];

  const nativePlugins = [
    ...basePlugins,
    '@react-native-firebase/app',
    '@react-native-firebase/crashlytics',
    '@react-native-firebase/perf',
    [
      'expo-build-properties',
      {
        ios: { useFrameworks: 'static' },
        android: { minSdkVersion: 24 },
      },
    ],
  ];

  if (appleOn) {
    nativePlugins.push('expo-apple-authentication');
  }

  // Android: sin opciones → integración vía google-services.json (Firebase).
  // iOS: si defines EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME, usa el modo con scheme explícito.
  if (googleIosUrlScheme) {
    nativePlugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: googleIosUrlScheme },
    ]);
  } else {
    nativePlugins.push('@react-native-google-signin/google-signin');
  }

  return {
    ...root,
    expo: {
      ...expo,
      plugins: nativePlugins,
      ios: {
        ...(expo.ios || {}),
        bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.juanndda.ceti',
      },
      android: {
        ...(expo.android || {}),
        googleServicesFile: './google-services.json',
      },
      extra: {
        ...(expo.extra || {}),
        eas: {
          ...(expo.extra?.eas || {}),
          projectId: process.env.EAS_PROJECT_ID || expo.extra?.eas?.projectId || '',
        },
        firebase: {
          apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
          authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
          measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
        },
        pinPepper: process.env.EXPO_PUBLIC_PIN_PEPPER || '',
        googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
        googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
        googleIosUrlScheme,
        featureAppleSignIn: appleOn,
      },
    },
  };
};
