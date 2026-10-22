/**
 * Accesorios del avatar. Cada uno se dibuja una sola vez en un marco común:
 * origen en el punto medio entre los ojos, eje y hacia abajo y 100 unidades
 * = distancia entre los centros de los ojos. Cada personaje declara sus ojos
 * (`AnclaOjos`) y el accesorio se lleva a su cara con translate + scale.
 *
 * Referencias en ese marco (iguales en Juan, Santiago y Sofi): ojos en x=±50,
 * coronilla en y≈-170, orejas en x≈±135.
 *
 * Estilo del elenco: sin contorno, relleno plano y un borde un tono más oscuro
 * (la misma forma, un poco más grande, detrás).
 */

export type AccesorioId = 'gafas-sol' | 'gorra' | 'audifonos' | 'estrellas';

export type AnclaOjos = { cx: number; cy: number; sep: number };

function estrella(cx: number, cy: number, r: number): string {
  const puntos: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.5;
    puntos.push(
      `${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`
    );
  }
  return puntos.join(' ');
}

function estrellaConBorde(cx: number, cy: number, r: number): string {
  const p = estrella(cx, cy, r);
  return (
    `<polygon points="${p}" fill="#E5A438" stroke="#E5A438" stroke-width="12" stroke-linejoin="round"/>` +
    `<polygon points="${p}" fill="#F7C95F" stroke="#F7C95F" stroke-width="4" stroke-linejoin="round"/>` +
    `<circle cx="${(cx - r * 0.18).toFixed(1)}" cy="${(cy - r * 0.22).toFixed(1)}" r="${(r * 0.14).toFixed(1)}" fill="#FFF1C9"/>`
  );
}

const DIBUJOS: Record<AccesorioId, string> = {
  'gafas-sol':
    '<rect x="-14" y="-14" width="28" height="9" rx="4" fill="#1C1E30"/>' +
    '<rect x="-96" y="-33" width="92" height="66" rx="25" fill="#1C1E30"/>' +
    '<rect x="4" y="-33" width="92" height="66" rx="25" fill="#1C1E30"/>' +
    '<rect x="-92" y="-29" width="84" height="58" rx="22" fill="#34385A"/>' +
    '<rect x="8" y="-29" width="84" height="58" rx="22" fill="#34385A"/>' +
    '<path d="M-78 10 L-52 -22 L-40 -22 L-66 10 Z M22 10 L48 -22 L60 -22 L34 10 Z" fill="#5A6090"/>',
  gorra:
    '<path d="M-139 -62 C-141 -150 -80 -195 0 -195 C80 -195 141 -150 139 -62 Z" fill="#C9500B"/>' +
    '<path d="M-133 -66 C-135 -146 -77 -189 0 -189 C77 -189 135 -146 133 -66 Z" fill="#FB6711"/>' +
    '<path d="M-60 -182 C-30 -170 -18 -120 -18 -68 L18 -68 C18 -120 30 -170 60 -182 C30 -190 -30 -190 -60 -182 Z" fill="#FF8A3D"/>' +
    '<path d="M-150 -70 C-90 -86 90 -86 150 -70 C140 -40 90 -26 0 -26 C-90 -26 -140 -40 -150 -70 Z" fill="#C9500B"/>' +
    '<path d="M-142 -68 C-86 -82 86 -82 142 -68 C132 -44 86 -32 0 -32 C-86 -32 -132 -44 -142 -68 Z" fill="#E85D0C"/>' +
    '<circle cx="0" cy="-128" r="27" fill="#E8C49A"/>' +
    '<circle cx="0" cy="-128" r="23" fill="#FFE9CC"/>' +
    '<path d="M-13 -126 C-13 -138 10 -140 13 -128 L19 -134 L18 -122 L12 -124 C8 -116 -13 -116 -13 -126 Z" fill="#FB6711"/>' +
    '<circle cx="0" cy="-193" r="9" fill="#C9500B"/>',
  audifonos:
    '<path d="M-143 -10 C-150 -150 -80 -205 0 -205 C80 -205 150 -150 143 -10" fill="none" stroke="#5E4BD0" stroke-width="28" stroke-linecap="round"/>' +
    '<path d="M-143 -10 C-150 -150 -80 -205 0 -205 C80 -205 150 -150 143 -10" fill="none" stroke="#8E7CFF" stroke-width="18" stroke-linecap="round"/>' +
    '<rect x="-176" y="-44" width="56" height="92" rx="24" fill="#5E4BD0"/>' +
    '<rect x="-172" y="-40" width="48" height="84" rx="20" fill="#8E7CFF"/>' +
    '<rect x="-160" y="-26" width="22" height="56" rx="11" fill="#B9AEFF"/>' +
    '<rect x="120" y="-44" width="56" height="92" rx="24" fill="#5E4BD0"/>' +
    '<rect x="124" y="-40" width="48" height="84" rx="20" fill="#8E7CFF"/>' +
    '<rect x="138" y="-26" width="22" height="56" rx="11" fill="#B9AEFF"/>',
  estrellas:
    estrellaConBorde(-78, -208, 20) +
    estrellaConBorde(0, -236, 27) +
    estrellaConBorde(78, -208, 20),
};

/** Alto (en unidades del marco) que sobresale por encima de la coronilla. */
export const ALTO_SOBRE_CABEZA = 105;

export function dibujoDeAccesorio(id: AccesorioId, ojos: AnclaOjos): string {
  const s = ojos.sep / 100;
  return `<g id="accesorio-${id}" transform="translate(${ojos.cx} ${ojos.cy}) scale(${s.toFixed(4)})">${DIBUJOS[id]}</g>`;
}

/** Encuadre de cada accesorio solo, para su ficha en el vestidor. */
const CAJA_ICONO: Record<AccesorioId, string> = {
  'gafas-sol': '-104 -44 208 88',
  gorra: '-162 -206 324 190',
  audifonos: '-186 -222 372 280',
  estrellas: '-110 -272 220 92',
};

export function iconoDeAccesorio(id: AccesorioId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CAJA_ICONO[id]}">${DIBUJOS[id]}</svg>`;
}
