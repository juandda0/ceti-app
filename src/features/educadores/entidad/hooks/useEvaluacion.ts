/**
 * Escala de notas y periodos de la entidad del profe (Fase 6), para Notas, el
 * Análisis de la clase, la ficha y la exportación. Sin configuración: escala
 * 1,0–5,0 y los 4 periodos del calendario A (o los 2 semestres si la entidad es
 * una universidad). Se lee una vez por colegio y se comparte entre pantallas.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  evaluacionDesdeDoc,
  evaluacionPorDefecto,
  periodoActualDe,
  periodosDelAnio,
  type ConfigEvaluacion,
  type EscalaSiee,
  type PeriodoConNombre,
} from '@/functions/src/educadores/dominio';
import { entidadRepository } from '../data/entidadRepository';

export interface Evaluacion {
  /** null = sin entidad o sin configurar: rige el calendario A. */
  config: ConfigEvaluacion | null;
  escala: EscalaSiee;
  cargando: boolean;
  periodosDe: (anio: number) => PeriodoConNombre[];
  periodoActual: (ms: number) => PeriodoConNombre;
}

const cache = new Map<string, Promise<ConfigEvaluacion | null>>();

/** Lee (una vez) la configuración del colegio. Exportado para los cargadores. */
export function evaluacionDeColegio(colegioId: string): Promise<ConfigEvaluacion | null> {
  let p = cache.get(colegioId);
  if (!p) {
    p = Promise.all([entidadRepository.evaluacion(colegioId), entidadRepository.leer(colegioId)])
      .then(([doc, vista]) => {
        if (doc) return evaluacionDesdeDoc(doc);
        // Una universidad sin configurar arranca con semestres.
        return vista.entidad?.tipo === 'universidad' ? evaluacionPorDefecto('semestres') : null;
      })
      .catch(() => null);
    cache.set(colegioId, p);
  }
  return p;
}

/** Tras guardar la escala, las pantallas la vuelven a leer. */
export function olvidarEvaluacion(colegioId: string): void {
  cache.delete(colegioId);
}

export function useEvaluacion(): Evaluacion {
  const colegioId = useAuthStore((s) => s.colegioId);
  const [config, setConfig] = useState<ConfigEvaluacion | null>(null);
  const [cargando, setCargando] = useState(!!colegioId);

  useEffect(() => {
    let vivo = true;
    if (!colegioId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    void evaluacionDeColegio(colegioId).then((c) => {
      if (!vivo) return;
      setConfig(c);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [colegioId]);

  return {
    config,
    escala: config?.escala ?? evaluacionPorDefecto().escala,
    cargando,
    periodosDe: (anio) => periodosDelAnio(config, anio),
    periodoActual: (ms) => periodoActualDe(config, ms),
  };
}
