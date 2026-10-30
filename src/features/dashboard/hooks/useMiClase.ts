/**
 * Las clases del estudiante que inició sesión (hasta 5): nombre, grado y si su
 * profe ya confirmó la autorización. Sin clases = usa Ceti por su cuenta. Las
 * reglas le dejan leer cada clase y su propio estado aunque siga pendiente.
 *
 * `useMiClase` es la clase del espacio abierto en Aprender (null en "Mi galaxia").
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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

export const MAX_CLASES_ESTUDIANTE = 5;

async function leerClase(colegioId: string, cursoId: string, uid: string) {
  return Promise.all([
    rosterRepository.getCurso(colegioId, cursoId),
    rosterRepository.getEstudiante(colegioId, cursoId, uid),
  ]);
}

async function cargarClase(colegioId: string, cursoId: string, uid: string): Promise<MiClase> {
  let leido: Awaited<ReturnType<typeof leerClase>> | null = null;
  try {
    leido = await leerClase(colegioId, cursoId, uid);
  } catch {
    // Recién unido: Firestore puede tardar un instante en usar el token con la
    // clase nueva y las reglas niegan la primera lectura. Un reintento basta.
    await new Promise((r) => setTimeout(r, 1200));
    leido = await leerClase(colegioId, cursoId, uid).catch(() => null);
  }
  const [curso, yo] = leido ?? [null, null];
  return {
    colegioId,
    cursoId,
    nombre: curso?.nombre ?? '',
    grado: curso?.grado ?? null,
    estado: yo?.estado ?? null,
  };
}

export function useMisClases(): { clases: MiClase[]; cargando: boolean; recargar: () => void } {
  const role = useAuthStore((s) => s.role);
  const mapa = useAuthStore((s) => s.clases);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [clases, setClases] = useState<MiClase[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vuelta, setVuelta] = useState(0);
  // Clave estable del mapa para no recargar en cada render.
  const clave = useMemo(
    () =>
      Object.entries(mapa)
        .sort()
        .map(([k, v]) => `${v}/${k}`)
        .join(','),
    [mapa]
  );

  useEffect(() => {
    const pares = clave ? clave.split(',').map((p) => p.split('/') as [string, string]) : [];
    if (role !== 'estudiante' || !uid || pares.length === 0) {
      setClases([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    void Promise.all(
      pares.map(([colegioId, cursoId]) => cargarClase(colegioId, cursoId, uid))
    ).then((lista) => {
      if (cancelado) return;
      setClases(lista);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [role, uid, clave, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { clases, cargando, recargar };
}

/** La clase del espacio abierto en Aprender; null en "Mi galaxia" o sin clases. */
export function useMiClase(): { clase: MiClase | null; cargando: boolean } {
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [clase, setClase] = useState<MiClase | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (role !== 'estudiante' || !colegioId || !cursoId || !uid) {
      setClase(null);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    void cargarClase(colegioId, cursoId, uid).then((c) => {
      if (cancelado) return;
      setClase(c);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [role, colegioId, cursoId, uid]);

  return { clase, cargando };
}
