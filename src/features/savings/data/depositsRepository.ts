import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import type { SavingsDeposit } from '@features/savings/store/useSavingsStore';
import type { SavingsOperation } from '@features/savings/domain/savings';

export const depositsRepository = {
  async upsertOperation(operation: SavingsOperation): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.put(`/api/me/deposits/${seg(operation.id)}`, operation);
    return true;
  },
  async upsertDeposit(deposit: SavingsDeposit): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.put(`/api/me/deposits/${seg(deposit.id)}`, deposit);
    return true;
  },
  async removeDeposit(depositId: string): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.del(`/api/me/deposits/${seg(depositId)}`);
    return true;
  },
};
