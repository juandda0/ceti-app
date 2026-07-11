/**
 * Cross-platform dialogs. RN-web's Alert renders nothing (and its buttons
 * never fire), so on web we fall back to the browser's native confirm/alert —
 * a destructive action must NEVER proceed without a working confirmation.
 */
import { Alert, Platform } from 'react-native';

export function showMessage(title: string, body?: string): void {
  if (Platform.OS === 'web') {
    if (typeof globalThis.alert === 'function') {
      globalThis.alert(body ? `${title}\n\n${body}` : title);
    }
    return;
  }
  Alert.alert(title, body);
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
  if (Platform.OS === 'web') {
    if (typeof globalThis.confirm === 'function' && globalThis.confirm(`${title}\n\n${body}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, body, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
