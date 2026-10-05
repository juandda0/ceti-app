import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

export const movimientosRepository = {
  async upsertMovimiento(movimiento: Movimiento): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.put(`/api/me/movimientos/${seg(movimiento.id)}`, {
      id: movimiento.id,
      tipo: 'gasto',
      monto: movimiento.monto,
      descripcion: movimiento.descripcion,
      categoria: movimiento.categoria,
      origen: movimiento.origen,
      fecha: movimiento.fecha ?? movimiento.createdAt,
      createdAt: movimiento.createdAt,
      updatedAt: movimiento.updatedAt ?? movimiento.createdAt,
    });
    return true;
  },
  async removeMovimiento(movimientoId: string): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.del(`/api/me/movimientos/${seg(movimientoId)}`);
    return true;
  },
};
