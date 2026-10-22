import type { TFunction } from 'i18next';
import type { Bitacora } from '@/functions/src/educadores/dominio';
import type { Destino } from '../data/siguientePaso';

/** Texto del botón principal de la Bitácora según el siguiente paso. */
export function textoPaso(t: TFunction, b: Bitacora, destino: Destino): string {
  switch (destino.paso) {
    case 'crear_clase':
      return t('educadores.bitacora.paso.crear_clase');
    case 'invitar':
      return t('educadores.bitacora.paso.invitar');
    case 'revisar_alertas':
      return t('educadores.bitacora.paso.revisar_alertas', { count: b.alertas.length });
    case 'reforzar_mundo':
      return b.mundoMasDificil
        ? t('educadores.bitacora.paso.reforzar_mundo', { mundo: b.mundoMasDificil.nombre })
        : t('educadores.bitacora.paso.asignar');
    default:
      return t('educadores.bitacora.paso.asignar');
  }
}
