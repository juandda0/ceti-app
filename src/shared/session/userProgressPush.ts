export async function flushUserProgressPush(): Promise<void> {
  // Las mutaciones CRUD esperan su escritura directamente; no queda una cola
  // global que pueda mezclar datos entre sesiones.
}
