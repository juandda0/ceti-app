/**
 * Evita múltiples instancias de MainActivity en Android (recomendado por expo-router
 * cuando aparece "linking in multiple places" tras volver desde OAuth / share intent).
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withAndroidMainActivitySingleTask(config) {
  return withAndroidManifest(config, (mod) => {
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    main.$['android:launchMode'] = 'singleTask';
    return mod;
  });
};
