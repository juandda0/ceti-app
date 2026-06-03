/**
 * Browser file download (web MVP). Returns false on native, where export is
 * deferred (caller should surface a "use the web app" message). Web-first by
 * design — the school product runs in the browser.
 */
import { Platform } from 'react-native';

export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8;'
): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Web print dialog (Save as PDF). No-op/false on native. */
export function printPage(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  window.print();
  return true;
}

/** Opens an HTML document in a new window and prints it (Save as PDF). Web only. */
export function printHtml(html: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
