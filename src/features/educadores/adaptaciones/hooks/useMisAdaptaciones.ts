/**
 * Fase 8c — las adaptaciones que aplican al estudiante en el espacio de la clase
 * abierta: las suyas más «leer en voz alta» de la clase (1° a 3° por defecto).
 * En «Mi galaxia» o sin clase, ninguna.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import {
  SIN_ADAPTACIONES,
  adaptacionesEfectivas,
  vozDeClase,
  type ConfigAccesibilidad,
  type MapaAdaptaciones,
} from '@/functions/src/educadores/dominio';
import { adaptacionesRepository } from '../data/adaptacionesRepository';

export function useMisAdaptaciones(): MapaAdaptaciones {
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [propias, setPropias] = useState<MapaAdaptaciones | null>(null);
  const [clase, setClase] = useState<ConfigAccesibilidad | null>(null);
  const [grado, setGrado] = useState<string | null>(null);
  const enClase = role === 'estudiante' && !!colegioId && !!cursoId && !!uid;

  useEffect(() => {
    if (!enClase || !colegioId || !cursoId || !uid) {
      setPropias(null);
      setClase(null);
      setGrado(null);
      return;
    }
    let cancelado = false;
    void rosterRepository
      .getCursoGrado(colegioId, cursoId)
      .then((g) => {
        if (!cancelado) setGrado(g);
      })
      .catch(() => undefined);
    const a = adaptacionesRepository.escuchar(colegioId, cursoId, uid, setPropias);
    const b = adaptacionesRepository.escucharClase(colegioId, cursoId, setClase);
    return () => {
      cancelado = true;
      a();
      b();
    };
  }, [enClase, colegioId, cursoId, uid]);

  if (!enClase) return SIN_ADAPTACIONES;
  return adaptacionesEfectivas(propias, vozDeClase(clase, grado));
}
