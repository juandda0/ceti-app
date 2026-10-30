/**
 * La clase del estudiante que inició sesión: nombre, grado y si su profe ya
 * confirmó la autorización. `clase: null` = no está en ninguna clase (usa Ceti
 * por su cuenta). Las reglas le dejan leer su clase y su propio estado aunque
 * siga pendiente.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import type { EstudianteEstado } from '@shared/types/tenancy';

export interface MiClase {
  colegioId: string;
  cursoId: string;
  nombre: string;
  grado: string | null;
  estado: EstudianteEstado | null;
}

export function useMiClase(): { clase: MiClase | null; cargando: boolean; recargar: () => void } {
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [clase, setClase] = useState<MiClase | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    if (role !== 'estudiante' || !colegioId || !cursoId || !uid) {
      setClase(null);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    void (async () => {
      const [curso, yo] = await Promise.all([
        rosterRepository.getCurso(colegioId, cursoId).catch(() => null),
        rosterRepository.getEstudiante(colegioId, cursoId, uid).catch(() => null),
      ]);
      if (cancelado) return;
      setClase({
        colegioId,
        cursoId,
        nombre: curso?.nombre ?? '',
        grado: curso?.grado ?? null,
        estado: yo?.estado ?? null,
      });
      setCargando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [role, colegioId, cursoId, uid, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { clase, cargando, recargar };
}
