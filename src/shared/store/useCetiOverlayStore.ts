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

interface CetiOverlayState {
  confirm: CetiConfirmPayload | null;
  notice: CetiNoticePayload | null;
  showConfirm: (payload: CetiConfirmPayload) => void;
  dismissConfirm: () => void;
  showNotice: (payload: CetiNoticePayload) => void;
  dismissNotice: () => void;
}

export const useCetiOverlayStore = create<CetiOverlayState>((set) => ({
  confirm: null,
  notice: null,

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
}));

export function showCetiConfirm(payload: CetiConfirmPayload) {
  useCetiOverlayStore.getState().showConfirm(payload);
}

export function showCetiNotice(payload: CetiNoticePayload) {
  useCetiOverlayStore.getState().showNotice(payload);
}
