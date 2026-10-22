import { useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';

/**
 * Nombre de la clase para el encabezado. Las pantallas lo reciben en
 * `?nombre=` al navegar desde la lista; si se abren por enlace directo, lo lee
 * del documento del curso. Mientras tanto (o sin conexión) muestra el id.
 */
export function useNombreCurso(cursoId: string, nombreParam?: string): string {
  const colegioId = useAuthStore((s) => s.colegioId);
  const [leido, setLeido] = useState<string | null>(null);

  useEffect(() => {
    if (nombreParam || !colegioId || !cursoId) return;
    let cancelado = false;
    void rosterRepository
      .getCursoNombre(colegioId, cursoId)
      .then((n) => {
        if (!cancelado) setLeido(n);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId, nombreParam]);

  return nombreParam ?? leido ?? cursoId;
}
