/**
 * Reporte de errores. Sin proveedor externo: van a la consola (logcat / consola
 * del navegador) para que ningún fallo quede silenciado.
 * ponytail: consola; enchufar Sentry aquí si hace falta agregarlos en un servidor.
 */
export function recordBoundaryError(error: Error, componentStack: string): void {
  console.error('[error-boundary]', error.message, componentStack.slice(0, 200));
}

export function recordError(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[${context ?? 'error'}]`, err.message);
}
