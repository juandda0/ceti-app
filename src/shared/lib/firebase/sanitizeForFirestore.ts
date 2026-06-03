/**
 * Firestore rechaza `undefined` en cualquier nivel del payload de escritura.
 */
export function stripUndefinedValues<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) o[k] = v;
  }
  return o;
}
