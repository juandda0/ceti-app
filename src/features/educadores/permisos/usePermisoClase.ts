/**
 * Fase 9 — el permiso del profe en una clase: `edita` o `califica` (ve todo y
 * califica, sin cambiar la clase). Solo esconde botones: las reglas y los
 * callables lo hacen cumplir. Mientras carga, deja pasar (como useMuro).
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { permisoEnClase, puedeEnClase, type AccionClase, type PermisoClase } from '@/functions/src/educadores/dominio';

// Una lectura por clase en la sesión; `olvidarPermisoClase` la refresca.
const cache = new Map<string, Promise<CursoWithId | null>>();

export function olvidarPermisoClase(cursoId: string): void {
  for (const k of cache.keys()) if (k.endsWith(`/${cursoId}`)) cache.delete(k);
}

export interface PermisoDeClase {
  /** null mientras carga o si no es profe de la clase. */
  permiso: PermisoClase | null;
  soloCalifica: boolean;
  puede: (accion: AccionClase) => boolean;
}

export function usePermisoClase(cursoId: string | null | undefined): PermisoDeClase {
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [curso, setCurso] = useState<CursoWithId | null | undefined>(undefined);

  useEffect(() => {
    if (!colegioId || !cursoId) return;
    let vivo = true;
    const k = `${colegioId}/${cursoId}`;
    if (!cache.has(k)) cache.set(k, rosterRepository.getCurso(colegioId, cursoId).catch(() => null));
    void cache.get(k)!.then((c) => {
      if (vivo) setCurso(c);
    });
    return () => {
      vivo = false;
    };
  }, [colegioId, cursoId]);

  const permiso = curso && uid ? permisoEnClase(curso, uid) : null;
  const puede = useCallback(
    (accion: AccionClase) => (curso === undefined || !uid ? true : puedeEnClase(curso, uid, accion)),
    [curso, uid]
  );
  return { permiso, soloCalifica: permiso === 'califica', puede };
}
