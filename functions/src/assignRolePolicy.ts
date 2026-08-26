export function parseProfessorAssignment(data: unknown) {
  if (typeof data !== 'object' || data === null) throw new Error('invalid assignment');
  const value = data as Record<string, unknown>;
  if (
    value.role !== 'profesor' ||
    typeof value.colegioId !== 'string' ||
    !value.colegioId.trim() ||
    'cursoId' in value
  ) {
    throw new Error('invalid assignment');
  }
  return { role: 'profesor' as const, colegioId: value.colegioId.trim() };
}
