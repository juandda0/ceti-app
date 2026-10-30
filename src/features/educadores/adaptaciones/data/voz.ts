/**
 * Fase 8c — «leer en voz alta»: la voz del celular (expo-speech; en web, la del
 * navegador), en español de Colombia si la hay. Nada sale del dispositivo.
 */
import * as Speech from 'expo-speech';

export function leer(texto: string) {
  const limpio = texto.replace(/_{2,}/g, ' espacio ').trim();
  if (!limpio) return;
  Speech.stop();
  Speech.speak(limpio, { language: 'es-CO', rate: 0.95 });
}

export function callar() {
  Speech.stop();
}

/** El enunciado y las opciones en una sola lectura: «Opción A: …». */
export function textoPregunta(enunciado: string, opciones: readonly string[], letras = 'ABCDEF'): string {
  return [enunciado, ...opciones.map((o, i) => `Opción ${letras[i] ?? i + 1}: ${o}.`)].join(' ');
}
