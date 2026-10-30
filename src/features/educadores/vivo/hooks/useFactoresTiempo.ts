/**
 * Fase 8c — el proyector espera a quien tiene «más tiempo»: el mayor factor
 * entre los estudiantes que entraron a la clase en vivo (1 si nadie lo tiene).
 */
import { useEffect, useState } from 'react';
import { FACTOR_MAS_TIEMPO } from '@/functions/src/educadores/dominio';
import { adaptacionesRepository } from '../../adaptaciones/data/adaptacionesRepository';

export function useFactoresTiempo(colegioId: string | null, cursoId: string, uids: readonly string[]): number {
  const [factor, setFactor] = useState(1);
  const clave = [...uids].sort().join(',');
  useEffect(() => {
    if (!colegioId || !cursoId || !clave) return setFactor(1);
    let cancelado = false;
    void adaptacionesRepository
      .deVarios(colegioId, cursoId, clave.split(','))
      .then((m) => {
        if (!cancelado) setFactor(Object.values(m).some((a) => a.masTiempo) ? FACTOR_MAS_TIEMPO : 1);
      })
      .catch(() => {
        if (!cancelado) setFactor(1);
      });
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId, clave]);
  return factor;
}
