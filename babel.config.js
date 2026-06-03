module.exports = function (api) {
  api.cache(true);
  return {
    // unstable_transformImportMeta: Firebase JS SDK v12 (ESM) emits `import.meta`,
    // which crashes the web bundle when loaded as a classic script
    // ("Cannot use 'import.meta' outside a module"). This transforms it away.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
