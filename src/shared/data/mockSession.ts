// data/mockSession.ts — Sesión vacía para inicio desde cero
// Eliminados todos los datos de prueba.

export interface MockChild {
  id: string;
  nickname: string;
  fullName: string;
  age: number;
  avatarEmoji: string;
  xp: number;
  streak: number;
  totalSaved: number;
  totalLessons: number;
  pendingDeposits: number;
  accuracy: number;
  savingsHistory: number[];
  educationHistory: number[];
}

export interface MockParent {
  id: string;
  name: string;
  children: string[];
}

export const MOCK_PARENT: MockParent = {
  id: '',
  name: '',
  children: [],
};

export const MOCK_CHILDREN: Record<string, MockChild> = {};

export const WEEK_LABELS = ['S-7', 'S-6', 'S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'Hoy'];

export const MOCK_SAVINGS_HISTORY: Record<string, number[]> = {
  all: [0, 0, 0, 0, 0, 0, 0, 0],
};
