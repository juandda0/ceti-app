import { create } from 'zustand';

export type CetiNoticeVariant = 'success' | 'error' | 'info';

export interface CetiConfirmPayload {
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export interface CetiNoticePayload {
  variant: CetiNoticeVariant;
  title: string;
  message?: string;
  /** Tras cerrar el aviso (p. ej. navegar). */
  onDismiss?: () => void;
}

export interface CetiToastPayload {
  id: number;
  variant: CetiNoticeVariant;
  title: string;
  message?: string;
  durationMs: number;
}

/** Toast efímero: no bloquea, se auto-descarta. Éxitos y validaciones ligeras. */
export type CetiToastInput = Omit<CetiToastPayload, 'id' | 'durationMs'> & { durationMs?: number };

interface CetiOverlayState {
  confirm: CetiConfirmPayload | null;
  notice: CetiNoticePayload | null;
  toasts: CetiToastPayload[];
  showConfirm: (payload: CetiConfirmPayload) => void;
  dismissConfirm: () => void;
  showNotice: (payload: CetiNoticePayload) => void;
  dismissNotice: () => void;
  showToast: (payload: CetiToastInput) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;

export const useCetiOverlayStore = create<CetiOverlayState>((set) => ({
  confirm: null,
  notice: null,
  toasts: [],

  showConfirm: (payload) =>
    set({
      confirm: {
        cancelLabel: 'Cancelar',
        confirmLabel: 'Continuar',
        ...payload,
      },
      notice: null,
    }),

  dismissConfirm: () => set({ confirm: null }),

  showNotice: (payload) => set({ notice: payload }),

  dismissNotice: () => set({ notice: null }),

  showToast: (payload) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
          ...payload,
          id: ++toastSeq,
          durationMs: payload.durationMs ?? (payload.variant === 'error' ? 4500 : 3000),
        },
      ].slice(-3), // apila máx. 3; los más viejos ceden espacio
    })),

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),
}));

export function showCetiConfirm(payload: CetiConfirmPayload) {
  useCetiOverlayStore.getState().showConfirm(payload);
}

export function showCetiNotice(payload: CetiNoticePayload) {
  useCetiOverlayStore.getState().showNotice(payload);
}

export function showCetiToast(payload: CetiToastInput) {
  useCetiOverlayStore.getState().showToast(payload);
}
