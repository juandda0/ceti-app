/**
 * Recoloreado de piel por transferencia en Lab: cada tono de piel del vector
 * (base, borde, nariz, rubor…) conserva su diferencia con el tono base, pero
 * aplicada sobre el tono elegido. Así los bordes siguen un poco más oscuros y
 * el rubor sigue rosado en cualquier tono. Puro.
 */

type Lab = { L: number; a: number; b: number };

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function rgbToHex(rgb: readonly number[]): string {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
      .toUpperCase()
  );
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) =>
  255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// Blanco D65
const XN = 0.95047;
const YN = 1;
const ZN = 1.08883;
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
const fInv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));

export function hexToLab(hex: string): Lab {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / XN;
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / YN;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / ZN;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToHex({ L, a, b }: Lab): string {
  const fy = (L + 16) / 116;
  const x = fInv(fy + a / 500) * XN;
  const y = fInv(fy) * YN;
  const z = fInv(fy - b / 200) * ZN;
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const bl = 0.0557 * x - 0.204 * y + 1.057 * z;
  return rgbToHex([r, g, bl].map(fromLinear));
}

/**
 * Mapa hex→hex que lleva una familia de colores (piel o pelo, cuyo tono base es
 * `base`) al tono `destino`. Las diferencias de luminosidad se escalan con la
 * luminosidad del destino para que en tonos oscuros los bordes no se vuelvan
 * negros y en tonos claros no desaparezcan; el factor se acota porque un pelo
 * casi negro llevado a rubio lo dispararía.
 */
export function mapaDeFamilia(
  base: string,
  familia: readonly string[],
  destino: string
): Record<string, string> {
  const b0 = hexToLab(base);
  const t = hexToLab(destino);
  const escala = Math.min(2.5, Math.max(0.4, t.L / Math.max(b0.L, 1)));
  const mapa: Record<string, string> = {};
  for (const hex of [base, ...familia]) {
    const c = hexToLab(hex);
    mapa[hex.toUpperCase()] = labToHex({
      L: t.L + (c.L - b0.L) * escala,
      a: t.a + (c.a - b0.a),
      b: t.b + (c.b - b0.b),
    });
  }
  return mapa;
}

/**
 * Aplica un mapa hex→hex a los `fill` y `stroke` de un SVG (sin distinguir
 * mayúsculas): los trazos pulidos (labios, párpados, costuras) van en `stroke`.
 */
export function recolorearSvg(svg: string, mapa: Record<string, string>): string {
  if (Object.keys(mapa).length === 0) return svg;
  return svg.replace(/(fill|stroke)="(#[0-9A-Fa-f]{6})"/g, (m, attr: string, hex: string) => {
    const nuevo = mapa[hex.toUpperCase()];
    return nuevo ? `${attr}="${nuevo}"` : m;
  });
}
