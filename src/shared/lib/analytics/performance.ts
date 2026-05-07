/**
 * Trazas de rendimiento (Firebase Performance). Stub hasta enlazar SDK nativo.
 */
export async function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const perfMod = require('@react-native-firebase/perf');
    const trace = perfMod.default().newTrace(name);
    trace.start();
    try {
      return await fn();
    } finally {
      trace.stop();
    }
  } catch {
    const result = await fn();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[perf] ${name}`, `${((Date.now() - t0) / 1000).toFixed(3)}s`);
    }
    return result;
  }
}
