/**
 * Fachada tipada de la callable `procesarRegistroVoz` (RQ-ES10/ES11). Solo envía
 * el TEXTO transcrito por el navegador; el audio jamás sale del dispositivo por
 * nuestro código. La función devuelve la clasificación y NO escribe en BD.
 *
 * v2 (RQ-ES11-CA5): la respuesta trae una lista `movimientos` (1..5) y, para
 * compat con clientes viejos, proyecta el primer ítem a nivel raíz.
 */
import { callFunction } from '@shared/lib/firebase/functions';
import type {
  MovimientoCategoria,
  MovimientoIntencion,
  MovimientoTipo,
} from '@features/savings/store/useMovimientosStore';

export interface ClasificacionMovimiento {
  intencion: MovimientoIntencion;
  tipo: MovimientoTipo;
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  confianza: number;
  // Desfase de fecha (transporte): el cliente lo resuelve a fecha local y NO lo
  // persiste. `offsetDias` −30..0; `diaSemana` opcional.
  offsetDias?: number;
  diaSemana?: string;
}

/** Respuesta de la callable: proyección del primer ítem + lista completa (v2). */
export interface RespuestaVoz extends ClasificacionMovimiento {
  movimientos?: ClasificacionMovimiento[];
}

export const VOZ_MAX_CHARS = 300;

export const vozService = {
  procesarRegistroVoz: (texto: string) =>
    callFunction<RespuestaVoz>('procesarRegistroVoz', {
      texto: texto.slice(0, VOZ_MAX_CHARS),
    }),
};

/** Normaliza la respuesta a una lista de 1..N clasificaciones (v2 o legacy). */
export function normalizarRespuestaVoz(r: RespuestaVoz): ClasificacionMovimiento[] {
  if (Array.isArray(r.movimientos) && r.movimientos.length > 0) return r.movimientos;
  const { movimientos: _omit, ...plano } = r;
  return [{ ...plano, offsetDias: plano.offsetDias ?? 0 }];
}
