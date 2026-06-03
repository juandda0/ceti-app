module.exports = function (api) {
  api.cache(true);
  return {
    // unstable_transformImportMeta: Firebase JS SDK v12 (ESM) emits `import.meta`,
    // which crashes the web bundle when loaded as a classic script
    // ("Cannot use 'import.meta' outside a module"). This transforms it away.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    env: {
      // Jest runs in a CommonJS VM that cannot execute native dynamic import().
      // Stores fire fire-and-forget `import()` side-effects (e.g. Firestore
      // sync); this rewrites them to require() so unit tests can run. Metro/web
      // bundles are unaffected (this only applies under NODE_ENV=test).
      test: {
        plugins: ['dynamic-import-node'],
      },
    },
  };
};
