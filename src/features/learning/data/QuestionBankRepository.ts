import { getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { questionBankByWorldQuery } from '@shared/lib/firebase/paths';
import type { QuestionBankItem, WorldId } from './questionBank.types';

export const questionBankRepository = {
  async fetchByWorldId(worldId: WorldId): Promise<QuestionBankItem[]> {
    const clients = getFirebaseClients();
    if (!clients) return [];

    const snap = await getDocs(questionBankByWorldQuery(clients.firestore, worldId));
    return snap.docs
      .map((d) => d.data() as QuestionBankItem)
      .sort((a, b) => a.id.localeCompare(b.id));
  },
};
