/**
 * Estado de juego por usuario (racha, XP, meta, Cetis, Bóveda, niveles). Vive en
 * el teléfono (MMKV) y se sincroniza con `users/{uid}/juego/orbita` (orbitaSync):
 * así sobrevive a cambiar de teléfono y puede alimentar avisos y widget.
 *
 * Las reglas están en domain/; aquí solo se guardan sus resultados.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { useQuizStreakStore } from '@features/learning/store/useQuizStreakStore';
import { dayKey } from '@features/orbita/domain/tiempo';
import {
  alAbrir,
  comprarEscudo,
  completarPractica,
  estadoInicial,
  type AjustesOrbita,
  type EstadoOrbita,
  type EventosApertura,
  type PracticaInput,
  type RecompensaPractica,
  type ResultadoEscudo,
} from '@features/orbita/domain/orbita';
import {
  abrirCdt,
  depositar,
  retirar,
  romperCdt,
  type ErrorBoveda,
  type PlazoCdt,
} from '@features/orbita/domain/boveda';

type ResultadoMovimiento = { ok: true } | { ok: false; error: ErrorBoveda };

type OrbitaState = {
  porUid: Record<string, EstadoOrbita>;
  /** Estado del usuario; lo crea (migrando la racha local anterior) si no existe. */
  asegurar: (uid: string, now?: number) => EstadoOrbita;
  abrir: (uid: string, now?: number) => EventosApertura;
  completar: (uid: string, input: PracticaInput, now?: number) => RecompensaPractica;
  comprarEscudo: (uid: string, now?: number) => ResultadoEscudo;
  depositar: (uid: string, monto: number, now?: number) => ResultadoMovimiento;
  retirar: (uid: string, monto: number, now?: number) => ResultadoMovimiento;
  abrirCdt: (uid: string, monto: number, semanas: PlazoCdt, now?: number) => ResultadoMovimiento;
  romperCdt: (uid: string, id: string, now?: number) => ResultadoMovimiento;
  configurar: (uid: string, cambios: Partial<AjustesOrbita>, now?: number) => void;
  /** Reemplaza con el documento remoto (orbitaSync decide cuál es más nuevo). */
  reemplazar: (uid: string, estado: EstadoOrbita) => void;
};

export const useOrbitaStore = create<OrbitaState>()(
  persist(
    (set, get) => {
      const guardar = (uid: string, estado: EstadoOrbita) =>
        set((s) => ({ porUid: { ...s.porUid, [uid]: estado } }));

      const asegurar = (uid: string, now = Date.now()) => {
        const actual = get().porUid[uid];
        if (actual) return actual;
        const previos = useQuizStreakStore.getState().daysByUid[uid] ?? [];
        // actualizadoEn 0: un estado recién creado aquí nunca le gana al remoto
        // (otro teléfono); solo una acción real lo marca como nuevo.
        const nuevo = { ...estadoInicial(now, previos), actualizadoEn: 0 };
        guardar(uid, nuevo);
        return nuevo;
      };

      const moverBoveda = (
        uid: string,
        now: number,
        mover: (e: EstadoOrbita) => ReturnType<typeof depositar>
      ): ResultadoMovimiento => {
        const e = asegurar(uid, now);
        const r = mover(e);
        if (!r.ok) return r;
        guardar(uid, { ...e, boveda: r.estado, actualizadoEn: now });
        return { ok: true };
      };

      return {
        porUid: {},
        asegurar,
        abrir: (uid, now = Date.now()) => {
          const { estado, eventos } = alAbrir(asegurar(uid, now), dayKey(now), now);
          if (estado !== get().porUid[uid]) guardar(uid, estado);
          return eventos;
        },
        completar: (uid, input, now = Date.now()) => {
          const r = completarPractica(asegurar(uid, now), input, dayKey(now), now);
          guardar(uid, r.estado);
          return r;
        },
        comprarEscudo: (uid, now = Date.now()) => {
          const r = comprarEscudo(asegurar(uid, now), dayKey(now), now);
          if (r.ok) guardar(uid, r.estado);
          return r;
        },
        depositar: (uid, monto, now = Date.now()) =>
          moverBoveda(uid, now, (e) => depositar(e.boveda, monto)),
        retirar: (uid, monto, now = Date.now()) =>
          moverBoveda(uid, now, (e) => retirar(e.boveda, monto)),
        abrirCdt: (uid, monto, semanas, now = Date.now()) =>
          moverBoveda(uid, now, (e) =>
            abrirCdt(e.boveda, monto, semanas, dayKey(now), `cdt_${now.toString(36)}`)
          ),
        romperCdt: (uid, id, now = Date.now()) =>
          moverBoveda(uid, now, (e) => romperCdt(e.boveda, id)),
        configurar: (uid, cambios, now = Date.now()) => {
          const e = asegurar(uid, now);
          guardar(uid, { ...e, ajustes: { ...e.ajustes, ...cambios }, actualizadoEn: now });
        },
        reemplazar: (uid, estado) => guardar(uid, estado),
      };
    },
    {
      name: 'orbita-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      partialize: (s) => ({ porUid: s.porUid }),
    }
  )
);
