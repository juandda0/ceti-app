/**
 * Analytics de producto: punto único de envío. Los tests de privacidad vigilan
 * qué parámetros pasan por aquí (p. ej. nunca montos), así que cualquier
 * proveedor futuro hereda esa garantía.
 * ponytail: sin proveedor (Firebase Analytics retirado); solo log en desarrollo.
 */
export async function logEvent(name: string, params: Record<string, unknown> = {}): Promise<void> {
  if (__DEV__) console.log('[analytics]', name, params);
}
