/**
 * La entidad del profe (Fase 6): su colegio compartido, sus miembros y si el
 * profe es admin. `recargar` después de un cambio. Sin entidad, `entidad` es
 * null y el profe sigue solo en su colegio.
 */
import { useCallback, useEffect, useState } from 'react';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { readCetiClaims } from '@shared/lib/firebase/claims';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { licenciaVigente } from '@/functions/src/educadores/dominio';
import { entidadRepository, type EntidadVista } from '../data/entidadRepository';

export interface MiEntidad {
  vista: EntidadVista | null;
  cargando: boolean;
  error: boolean;
  soyAdmin: boolean;
  /** La entidad tiene licencia vigente (panel, biblioteca, co-docentes). */
  conLicencia: boolean;
  recargar: () => Promise<void>;
}

export function useMiEntidad(): MiEntidad {
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [vista, setVista] = useState<EntidadVista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const recargar = useCallback(async () => {
    if (!colegioId) {
      setVista(null);
      setCargando(false);
      return;
    }
    try {
      setVista(await entidadRepository.leer(colegioId));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [colegioId]);

  useEffect(() => {
    setCargando(true);
    void recargar();
  }, [recargar]);

  const soyAdmin = !!vista?.entidad && vista.profes.some((p) => p.uid === uid && p.rol === 'admin');
  return {
    vista,
    cargando,
    error,
    soyAdmin,
    conLicencia: !!licenciaVigente(vista?.licencia, Date.now()),
    recargar,
  };
}

/** Tras entrar o salir de una entidad el colegio del profe cambia: relee los claims. */
export async function refrescarClaimsProfe(): Promise<void> {
  const user = getFirebaseClients()?.auth.currentUser;
  if (!user) return;
  await user.getIdToken(true);
  useAuthStore.getState().setClaims(await readCetiClaims(user, true));
}
