import { parsearRegistroVoz } from '@features/savings/data/vozParser';
export type { ClasificacionMovimiento } from '@features/savings/data/vozParser';

export const VOZ_MAX_CHARS = 300;

export const vozService = {
  clasificarRegistroLocal: async (texto: string) =>
    parsearRegistroVoz(texto.slice(0, VOZ_MAX_CHARS)),
};
