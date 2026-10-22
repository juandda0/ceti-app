/**
 * ¿Esta clase quedó en solo lectura? Pasa cuando el plan bajó (p. ej. a Cadete)
 * y el profe tiene más clases de las que el plan permite: se conservan
 * editables las más recientes y las demás se ven, pero no se editan. Nada se
 * borra y los estudiantes siguen jugando igual (contrato A).
 */
import { useEffect, useState } from 'react';
import { clasesEditables, type PlanId } from '@/functions/src/educadores/dominio';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '../hooks/useMiPlan';

/** Puro: la clase está fuera de las editables del plan. */
export function esClaseSoloLectura(
  plan: PlanId,
  cursos: readonly Pick<CursoWithId, 'id' | 'createdAt'>[],
  cursoId: string
): boolean {
  if (!cursos.some((c) => c.id === cursoId)) return false;
  const editables = clasesEditables(
    plan,
    cursos.map((c) => ({ id: c.id, creadaAt: c.createdAt ?? 0 }))
  );
  return !editables.has(cursoId);
}

export function useClaseSoloLectura(
  colegioId: string | null | undefined,
  cursoId: string | null | undefined
): boolean {
  const uid = useAuthStore((s) => s.firebaseUid);
  const { plan, limites, cargando } = useMiPlan();
  const [cursos, setCursos] = useState<CursoWithId[] | null>(null);
  const limitado = Number.isFinite(limites.clases);

  useEffect(() => {
    // Con clases ilimitadas no hace falta leer nada.
    if (!limitado || !colegioId || !uid) return;
    let cancelled = false;
    void rosterRepository
      .getCursosByProfesor(colegioId, uid)
      .then((list) => {
        if (!cancelled) setCursos(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [limitado, colegioId, uid]);

  if (cargando || !limitado || !cursos || !cursoId) return false;
  return esClaseSoloLectura(plan, cursos, cursoId);
}
