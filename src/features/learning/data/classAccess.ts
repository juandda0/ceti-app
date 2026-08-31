export function hasClassAccess(
  colegioId: string | null | undefined,
  cursoId: string | null | undefined
): boolean {
  return Boolean(colegioId?.trim() && cursoId?.trim());
}
