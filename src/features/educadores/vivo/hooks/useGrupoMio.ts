/** Fase 8 — el grupo del estudiante en la clase abierta (null sin grupo o en Mi galaxia). */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { grupoDe, type Grupo } from '@/functions/src/educadores/dominio';
import { gruposRepository } from '../../grupos/data/gruposRepository';

export function useGrupoMio(): Grupo | null {
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  useEffect(() => {
    if (!colegioId || !cursoId) return setGrupos([]);
    return gruposRepository.escuchar(colegioId, cursoId, setGrupos);
  }, [colegioId, cursoId]);
  return uid ? grupoDe(uid, grupos) : null;
}
