export function normalizeClassCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

/**
 * Código de clase a partir de lo que trae un QR: el enlace de invitación
 * (`https://…/join/ABC234`, `ceti://join/ABC234`) o el código solo. Devuelve
 * null si no parece un código de Ceti.
 */
export function codigoDesdeQr(texto: string): string | null {
  const limpio = texto.trim();
  const enlace = limpio.match(/\/join\/([A-Za-z0-9]{4,12})(?:[/?#]|$)/);
  const candidato = enlace ? enlace[1] : limpio;
  return /^[A-Za-z0-9]{4,12}$/.test(candidato) ? normalizeClassCode(candidato) : null;
}

export const NOMBRE_COMPLETO_MIN = 5;
export const NOMBRE_COMPLETO_MAX = 80;

/**
 * Nombre completo para la lista del profe: al menos dos palabras, sin espacios
 * de sobra. Devuelve null si no sirve.
 */
export function limpiarNombreCompleto(texto: string): string | null {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (limpio.length < NOMBRE_COMPLETO_MIN || limpio.length > NOMBRE_COMPLETO_MAX) return null;
  return limpio.split(' ').length >= 2 ? limpio : null;
}
