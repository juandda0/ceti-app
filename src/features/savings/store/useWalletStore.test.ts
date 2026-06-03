import { useWalletStore } from '@features/savings/store/useWalletStore';

const initialState = {
  totalCetis: 0,
  savedCetis: 0,
  spentCetis: 0,
  transactions: [],
  savingsGoal: null,
};

describe('useWalletStore', () => {
  beforeEach(() => {
    useWalletStore.setState({ ...initialState });
  });

  describe('earnCetis', () => {
    it('incrementa totalCetis y antepone una transacción', () => {
      useWalletStore.getState().earnCetis(10, 'Lección 1', 'lesson');
      const s = useWalletStore.getState();
      expect(s.totalCetis).toBe(10);
      expect(s.transactions).toHaveLength(1);
      expect(s.transactions[0]).toMatchObject({
        amount: 10,
        description: 'Lección 1',
        category: 'lesson',
        type: 'earned',
      });
    });

    it('antepone la transacción más reciente (orden LIFO)', () => {
      useWalletStore.getState().earnCetis(5, 'primera', 'lesson');
      useWalletStore.getState().earnCetis(7, 'segunda', 'lesson');
      const s = useWalletStore.getState();
      expect(s.totalCetis).toBe(12);
      expect(s.transactions[0].description).toBe('segunda');
      expect(s.transactions[1].description).toBe('primera');
    });

    it('mapea categoría task → tipo task_reward', () => {
      useWalletStore.getState().earnCetis(3, 'Tarea', 'task');
      expect(useWalletStore.getState().transactions[0].type).toBe('task_reward');
    });

    it('categoría decision → tipo earned', () => {
      useWalletStore.getState().earnCetis(3, 'Decisión', 'decision');
      expect(useWalletStore.getState().transactions[0].type).toBe('earned');
    });

    it('limita el historial de transacciones a 50', () => {
      for (let i = 0; i < 60; i++) {
        useWalletStore.getState().earnCetis(1, `tx ${i}`, 'lesson');
      }
      const s = useWalletStore.getState();
      expect(s.transactions).toHaveLength(50);
      expect(s.totalCetis).toBe(60);
      // la más reciente queda en el tope
      expect(s.transactions[0].description).toBe('tx 59');
    });
  });

  describe('spendCetis', () => {
    it('decrementa totalCetis y retorna true cuando hay fondos suficientes', () => {
      useWalletStore.setState({ totalCetis: 20 });
      const ok = useWalletStore.getState().spendCetis(5, 'Compra');
      const s = useWalletStore.getState();
      expect(ok).toBe(true);
      expect(s.totalCetis).toBe(15);
      expect(s.spentCetis).toBe(5);
      expect(s.transactions[0]).toMatchObject({ type: 'spent', amount: 5, category: 'decision' });
    });

    it('retorna false y no muta el estado cuando los fondos son insuficientes', () => {
      useWalletStore.setState({ totalCetis: 3 });
      const ok = useWalletStore.getState().spendCetis(5, 'Compra');
      const s = useWalletStore.getState();
      expect(ok).toBe(false);
      expect(s.totalCetis).toBe(3);
      expect(s.spentCetis).toBe(0);
      expect(s.transactions).toHaveLength(0);
    });

    it('permite gastar exactamente el saldo disponible', () => {
      useWalletStore.setState({ totalCetis: 5 });
      const ok = useWalletStore.getState().spendCetis(5, 'Todo');
      expect(ok).toBe(true);
      expect(useWalletStore.getState().totalCetis).toBe(0);
    });
  });

  describe('saveCetis', () => {
    it('mueve cetis de totalCetis a savedCetis y retorna true', () => {
      useWalletStore.setState({ totalCetis: 10 });
      const ok = useWalletStore.getState().saveCetis(4);
      const s = useWalletStore.getState();
      expect(ok).toBe(true);
      expect(s.totalCetis).toBe(6);
      expect(s.savedCetis).toBe(4);
      expect(s.transactions[0]).toMatchObject({ type: 'saved', amount: 4 });
    });

    it('retorna false y no muta cuando hay fondos insuficientes', () => {
      useWalletStore.setState({ totalCetis: 2 });
      const ok = useWalletStore.getState().saveCetis(5);
      const s = useWalletStore.getState();
      expect(ok).toBe(false);
      expect(s.totalCetis).toBe(2);
      expect(s.savedCetis).toBe(0);
      expect(s.transactions).toHaveLength(0);
    });
  });

  describe('withdrawSavings', () => {
    it('mueve cetis de savedCetis a totalCetis y retorna true', () => {
      useWalletStore.setState({ totalCetis: 1, savedCetis: 8 });
      const ok = useWalletStore.getState().withdrawSavings(3);
      const s = useWalletStore.getState();
      expect(ok).toBe(true);
      expect(s.totalCetis).toBe(4);
      expect(s.savedCetis).toBe(5);
    });

    it('retorna false y no muta cuando el ahorro es insuficiente', () => {
      useWalletStore.setState({ totalCetis: 1, savedCetis: 2 });
      const ok = useWalletStore.getState().withdrawSavings(5);
      const s = useWalletStore.getState();
      expect(ok).toBe(false);
      expect(s.totalCetis).toBe(1);
      expect(s.savedCetis).toBe(2);
    });
  });

  describe('addToGoal', () => {
    it('retorna false cuando no hay savingsGoal', () => {
      useWalletStore.setState({ totalCetis: 50, savingsGoal: null });
      const ok = useWalletStore.getState().addToGoal(10);
      expect(ok).toBe(false);
      expect(useWalletStore.getState().totalCetis).toBe(50);
    });

    it('retorna false cuando los fondos son insuficientes aun con meta', () => {
      useWalletStore.setState({
        totalCetis: 5,
        savingsGoal: { name: 'Bici', targetAmount: 100, currentAmount: 0 },
      });
      const ok = useWalletStore.getState().addToGoal(10);
      const s = useWalletStore.getState();
      expect(ok).toBe(false);
      expect(s.totalCetis).toBe(5);
      expect(s.savingsGoal?.currentAmount).toBe(0);
    });

    it('descuenta de totalCetis e incrementa currentAmount de la meta', () => {
      useWalletStore.setState({
        totalCetis: 30,
        savingsGoal: { name: 'Bici', targetAmount: 100, currentAmount: 20 },
      });
      const ok = useWalletStore.getState().addToGoal(10);
      const s = useWalletStore.getState();
      expect(ok).toBe(true);
      expect(s.totalCetis).toBe(20);
      expect(s.savingsGoal?.currentAmount).toBe(30);
      expect(s.transactions[0]).toMatchObject({
        type: 'saved',
        amount: 10,
        description: 'Meta: Bici',
      });
    });
  });

  describe('resetWallet', () => {
    it('restaura el estado inicial', () => {
      useWalletStore.setState({
        totalCetis: 99,
        savedCetis: 50,
        spentCetis: 12,
        transactions: [
          {
            id: 'x',
            type: 'earned',
            amount: 1,
            description: 'd',
            timestamp: 1,
            category: 'lesson',
          },
        ],
        savingsGoal: { name: 'Bici', targetAmount: 100, currentAmount: 40 },
      });
      useWalletStore.getState().resetWallet();
      const s = useWalletStore.getState();
      expect(s.totalCetis).toBe(0);
      expect(s.savedCetis).toBe(0);
      expect(s.spentCetis).toBe(0);
      expect(s.transactions).toHaveLength(0);
      expect(s.savingsGoal).toBeNull();
    });
  });
});
