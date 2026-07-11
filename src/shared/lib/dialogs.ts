/**
 * Diálogos de Ceti (UI propia, nunca la nativa del dispositivo).
 * `showMessage` → toast efímero; `confirmAction` → bottom sheet de confirmación.
 * La UI vive en `CetiOverlayHost` / `CetiToastHost`.
 */
import {
  CetiNoticeVariant,
  showCetiToast,
  showCetiConfirm,
} from '@shared/store/useCetiOverlayStore';

export function showMessage(
  title: string,
  body?: string,
  variant: CetiNoticeVariant = 'info'
): void {
  showCetiToast({ variant, title, message: body });
}

export function confirmAction(params: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  const { title, body, confirmLabel, cancelLabel, destructive, onConfirm } = params;
  showCetiConfirm({
    title,
    message: body,
    confirmLabel,
    cancelLabel,
    destructive,
    onConfirm,
  });
}
