/**
 * Fachada tipada de la callable `procesarRegistroVoz` (RQ-ES10). Solo envía el
 * TEXTO transcrito por el navegador; el audio jamás sale del dispositivo por
 * nuestro código. La función devuelve la clasificación y NO escribe en BD.
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
}

export const VOZ_MAX_CHARS = 300;

export const vozService = {
  procesarRegistroVoz: (texto: string) =>
    callFunction<ClasificacionMovimiento>('procesarRegistroVoz', {
      texto: texto.slice(0, VOZ_MAX_CHARS),
    }),
};
