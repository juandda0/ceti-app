/**
 * Espacios de Aprender (Fase 1): "Mi galaxia" y una por cada clase. La racha,
 * los XP, los Cetis y el avatar son de la cuenta; el avance de cada mundo es
 * del espacio. Estas claves separan ese avance sin tocar los stores:
 *
 * - progreso del banco de preguntas: el uid en Mi galaxia, `uid@cursoId` en una clase;
 * - lecciones hechas en Órbita: el worldId en Mi galaxia, `cursoId/worldId` en una clase.
 *
 * Mi galaxia usa las claves de siempre, así el avance de antes queda ahí.
 */
export function claveProgreso(uid: string, cursoId: string | null | undefined): string {
  return cursoId ? `${uid}@${cursoId}` : uid;
}

export function claveNivel(worldId: string, cursoId: string | null | undefined): string {
  return cursoId ? `${cursoId}/${worldId}` : worldId;
}
