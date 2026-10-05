import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import { cursoPath, estudiantePath } from '@shared/lib/api/paths';
import type { Curso, Estudiante, Grado } from '@shared/types/tenancy';

export type CursoWithId = Curso & { id: string };
export type EstudianteWithId = { uid: string } & Estudiante;

/** Reads the institutional roster (courses a teacher manages, students in a course). */
export const rosterRepository = {
  async getCursosByProfesor(colegioId: string): Promise<CursoWithId[]> {
    if (!isBackendConfigured()) return [];
    return api.get<CursoWithId[]>(`/api/colegios/${seg(colegioId)}/cursos`);
  },
  /** Courses of the school report: the backend only ever returns the caller's own. */
  async getAllCursos(colegioId: string): Promise<CursoWithId[]> {
    return this.getCursosByProfesor(colegioId);
  },
  /**
   * Reads the colegio's display name (any colegio member). Falls back to null
   * offline / not found, so callers can show the id or a placeholder.
   */
  async getColegioNombre(colegioId: string): Promise<string | null> {
    if (!isBackendConfigured()) return null;
    const c = await api.getOrNull<{ nombre: string }>(`/api/colegios/${seg(colegioId)}`);
    return c?.nombre ?? null;
  },
  async getRoster(colegioId: string, cursoId: string): Promise<EstudianteWithId[]> {
    if (!isBackendConfigured()) return [];
    return api.get<EstudianteWithId[]>(`${cursoPath(colegioId, cursoId)}/estudiantes`);
  },
  /** A single roster slot — the teacher, or a student reading their own status (even pending). */
  async getEstudiante(
    colegioId: string,
    cursoId: string,
    uid: string
  ): Promise<EstudianteWithId | null> {
    if (!isBackendConfigured()) return null;
    return api.getOrNull<EstudianteWithId>(estudiantePath(colegioId, cursoId, uid));
  },
  /**
   * Reads only the `grado` of a course (R4: grado comes from the course, never
   * from the student record). Used to pick the banco set for the quiz (R7/R9).
   * Falls back to null when offline / course not found.
   */
  async getCursoGrado(colegioId: string, cursoId: string): Promise<Grado | null> {
    if (!isBackendConfigured()) return null;
    const c = await api.getOrNull<Curso>(cursoPath(colegioId, cursoId));
    return c?.grado ?? null;
  },
};
