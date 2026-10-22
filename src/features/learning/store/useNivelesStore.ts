/**
 * Niveles armados por mundo (lecciones + jefe), en memoria. La galaxia los
 * precarga para mostrar "nivel X de N" y el mapa los usa para jugar. No se
 * persiste: el contenido depende del grado, del estudiante y de la versión de
 * la configuración de la clase, así que siempre se vuelve a pedir.
 */
import { create } from 'zustand';
import type { Grado, WorldId } from '@features/learning/data/quiz.types';
import type { CourseContentRef } from '@shared/types/tenancy';
import { armarNiveles, type NivelesMundo } from '@features/orbita/domain/niveles';

export type EstadoCarga = 'cargando' | 'listo' | 'error';

type NivelesState = {
  porMundo: Partial<Record<WorldId, { clave: string; estado: EstadoCarga; niveles?: NivelesMundo }>>;
  cargar: (
    grado: Grado,
    worldId: WorldId,
    semilla: string,
    courseContent?: CourseContentRef | null
  ) => Promise<void>;
  reiniciar: () => void;
};

export const useNivelesStore = create<NivelesState>()((set, get) => ({
  porMundo: {},
  cargar: async (grado, worldId, semilla, courseContent = null) => {
    const clave = `${grado}:${semilla}:v${courseContent?.version ?? 0}`;
    const actual = get().porMundo[worldId];
    if (actual?.clave === clave && actual.estado !== 'error') return;
    // Mientras recarga (p. ej. el profe guardó la clase) se conservan los niveles
    // anteriores: el mapa no parpadea y nada de lo que está en pantalla se desmonta.
    set((s) => ({
      porMundo: {
        ...s.porMundo,
        [worldId]: { clave, estado: 'cargando', niveles: actual?.niveles },
      },
    }));
    try {
      const { questionBankRepository } =
        await import('@features/learning/data/QuestionBankRepository');
      const pool = await questionBankRepository.fetchPool(grado, worldId, courseContent);
      const niveles = pool ? armarNiveles(pool, semilla) : null;
      set((s) => ({
        porMundo: {
          ...s.porMundo,
          [worldId]:
            niveles && niveles.jefe.length > 0
              ? { clave, estado: 'listo', niveles }
              : { clave, estado: 'error', niveles: actual?.niveles },
        },
      }));
    } catch (err) {
      if (__DEV__) console.warn('[niveles] cargar:', err);
      set((s) => ({
        porMundo: { ...s.porMundo, [worldId]: { clave, estado: 'error', niveles: actual?.niveles } },
      }));
    }
  },
  reiniciar: () => set({ porMundo: {} }),
}));
