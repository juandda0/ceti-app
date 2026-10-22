/**
 * Salidas de la app del profe: WhatsApp de Ceti y el checkout de Wompi.
 * En web el checkout reemplaza la pestaña (Wompi vuelve por `redirectUrl`); en
 * nativo se abre en el navegador del sistema. Una ruta interna ('/…', la usa la
 * demo /dev/profe) se navega dentro de la app.
 */
import { Linking, Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { numeroSoporte, urlWhatsApp } from '../data/planUi';

export function abrirWhatsApp(texto?: string): void {
  const url = urlWhatsApp(numeroSoporte(), texto);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url);
}

export async function abrirCheckout(url: string): Promise<void> {
  if (url.startsWith('/')) {
    router.replace(url as Href);
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}

/**
 * URL a la que Wompi devuelve al profe después del pago único (agrega `?id=`).
 * Es la misma ruta que el servidor usa por defecto: /pago.
 */
export function urlRegresoPago(): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/pago`;
  }
  return undefined;
}
