const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg').concat(['glb', 'gltf', 'lottie']),
  sourceExts: [...resolver.sourceExts, 'svg'],
  // Las pruebas no van al bundle: Expo Router carga todo lo que hay en app/ como ruta, y
  // app/(app)/app-tabs.test.tsx importa @testing-library (rompe la web en desarrollo).
  blockList: [/\.test\.[jt]sx?$/],
};

module.exports = config;
