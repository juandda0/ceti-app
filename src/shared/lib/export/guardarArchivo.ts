/**
 * Entrega un archivo al usuario: en web lo descarga; en el celular lo guarda en
 * la caché y abre la hoja de compartir (WhatsApp, Drive, correo…). Devuelve
 * false si no se pudo.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export async function guardarArchivo(
  nombre: string,
  contenido: Uint8Array | string,
  mime: string
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([contenido as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  try {
    const archivo = new File(Paths.cache, nombre);
    archivo.create({ overwrite: true });
    archivo.write(contenido);
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(archivo.uri, { mimeType: mime, dialogTitle: nombre });
    return true;
  } catch {
    return false;
  }
}

function imprimirHtmlWeb(html: string): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    Object.assign(marco.style, {
      position: 'fixed',
      width: '0',
      height: '0',
      border: '0',
      right: '0',
      bottom: '0',
    });
    marco.onload = () => {
      const ventana = marco.contentWindow;
      if (!ventana) return resolve(false);
      ventana.focus();
      ventana.print();
      // Se quita después: algunos navegadores imprimen de forma asíncrona.
      setTimeout(() => marco.remove(), 60_000);
      resolve(true);
    };
    marco.srcdoc = html;
    document.body.appendChild(marco);
  });
}

/**
 * Un informe en PDF a partir de HTML: en web abre la vista de impresión
 * ("Guardar como PDF"); en el celular genera el PDF y lo comparte.
 */
export async function compartirPdf(nombre: string, html: string): Promise<boolean> {
  try {
    // En web expo-print ignora el HTML e imprime la pantalla de la app: el
    // informe se imprime desde un iframe oculto.
    if (Platform.OS === 'web') return await imprimirHtmlWeb(html);
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: nombre,
      UTI: 'com.adobe.pdf',
    });
    return true;
  } catch {
    return false;
  }
}

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
