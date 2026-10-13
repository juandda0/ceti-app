/**
 * Racha de aprendizaje: días calendario (Bogotá) seguidos en los que la persona
 * termina al menos un quiz, con gracia de 1 día (la racha sigue viva hoy si
 * terminó uno ayer). Vive solo en el dispositivo, por usuario.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { dayKey } from '@features/savings/data/periodos';

const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_DIAS = 400;

/** Racha viva al instante `now` para un conjunto de días `YYYY-MM-DD`. Puro. */
export function computeQuizRacha(days: readonly string[], now: number = Date.now()): number {
  const set = new Set(days);
  let cursor = set.has(dayKey(now)) ? now : now - DIA_MS;
  let count = 0;
  while (set.has(dayKey(cursor))) {
    count++;
    cursor -= DIA_MS;
  }
  return count;
}

type QuizStreakState = {
  daysByUid: Record<string, string[]>;
  /** Registra un quiz terminado. `primeroHoy` indica si es el primero del día. */
  registrarQuiz: (uid: string, now?: number) => { primeroHoy: boolean; racha: number };
};

export const useQuizStreakStore = create<QuizStreakState>()(
  persist(
    (set, get) => ({
      daysByUid: {},
      registrarQuiz: (uid, now = Date.now()) => {
        const hoy = dayKey(now);
        const prev = get().daysByUid[uid] ?? [];
        const primeroHoy = !prev.includes(hoy);
        const days = primeroHoy ? [...prev, hoy].slice(-MAX_DIAS) : prev;
        if (primeroHoy) set((s) => ({ daysByUid: { ...s.daysByUid, [uid]: days } }));
        return { primeroHoy, racha: computeQuizRacha(days, now) };
      },
    }),
    {
      name: 'quiz-streak-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
