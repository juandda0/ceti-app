import { api, isBackendConfigured } from '@shared/lib/api/client';
import type { Presupuestos } from '@features/savings/data/presupuestos';

export const presupuestosRepository = {
  /**
   * Escribe el doc COMPLETO: un tope quitado desaparece del mapa. Un merge
   * profundo dejaría el tope viejo fantasma. RQ-ES11-CA1.
   */
  async guardar(topes: Presupuestos): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.put('/api/me/presupuestos', { topes, updatedAt: Date.now() });
    return true;
  },
  async borrar(): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.del('/api/me/presupuestos');
    return true;
  },
};
