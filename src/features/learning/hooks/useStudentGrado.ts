/**
 * useStudentGrado — resolves the student's grado from their CURSO.
 *
 * R4: grado lives on `cursos/{cursoId}.grado`, never on the minor. The student
 * carries `colegioId`/`cursoId` as custom claims; the grade is read from the
 * course doc. Returns `null` while resolving so callers can avoid fetching
 * content for the wrong grade; falls back to '9' for demo/offline students with
 * no provisioned course.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import type { Grado } from '@features/learning/data/quiz.types';

export function useStudentGrado(): Grado | null {
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const [grado, setGrado] = useState<Grado | null>(null);

  useEffect(() => {
    let active = true;
    // No provisioned course (demo/offline) → default grade.
    if (!colegioId || !cursoId) {
      setGrado('9');
      return;
    }
    // Reset to "resolving" while we read the new course, so content isn't fetched
    // for a stale grade between course switches.
    setGrado(null);
    void rosterRepository.getCursoGrado(colegioId, cursoId).then((g) => {
      if (active) setGrado(g ?? '9');
    });
    return () => {
      active = false;
    };
  }, [colegioId, cursoId]);

  return grado;
}
