/**
 * Arma el SVG final del avatar: piel y pelo recoloreados, accesorio encima y un
 * viewBox con aire arriba para lo que sobresale de la cabeza. Puro.
 */
import { ALTO_SOBRE_CABEZA, dibujoDeAccesorio } from './accesorios';
import { COLORES_PELO, TONOS_PIEL, type Arte, type AvatarConfig } from './catalogo';
import { mapaDeFamilia, recolorearSvg } from './color';

export type Encuadre = 'cuerpo' | 'retrato';

/** Rango [inicio, fin) del grupo `<g id="…">` con sus grupos anidados, o null. */
function rangoDeGrupo(svg: string, id: string): [number, number] | null {
  const inicio = svg.indexOf(`<g id="${id}"`);
  if (inicio < 0) return null;
  const re = /<g\b|<\/g>/g;
  re.lastIndex = inicio;
  let nivel = 0;
  for (let m = re.exec(svg); m; m = re.exec(svg)) {
    nivel += m[0] === '<g' ? 1 : -1;
    if (nivel === 0) return [inicio, re.lastIndex];
  }
  return null;
}

/**
 * Recolorea una familia (piel o pelo). Los tonos de `soloCabeza` los comparte
 * la ropa (el cordón del collar de Sofi, el cuello del traje de Santiago), así
 * que solo cambian dentro del grupo `cabeza`.
 */
function recolorearFamilia(svg: string, fam: Arte['piel'], tono: string): string {
  const { base, familia, soloCabeza = [] } = fam;
  const mapa = mapaDeFamilia(base, [...familia, ...soloCabeza], tono);
  const soloCab = new Set(soloCabeza.map((c) => c.toUpperCase()));
  const global = Object.fromEntries(Object.entries(mapa).filter(([hex]) => !soloCab.has(hex)));
  let out = recolorearSvg(svg, global);
  const rango = soloCab.size > 0 ? rangoDeGrupo(out, 'cabeza') : null;
  if (rango) {
    const [a, b] = rango;
    out = out.slice(0, a) + recolorearSvg(out.slice(a, b), mapa) + out.slice(b);
  }
  return out;
}

/** Caja visible en unidades del SVG: [x, y, ancho, alto]. */
export function cajaDe(arte: Arte, encuadre: Encuadre): [number, number, number, number] {
  const s = arte.ojos.sep / 100;
  if (encuadre === 'retrato') {
    // Cuadrado centrado en la cara: de encima de la coronilla (con accesorio) al cuello.
    const lado = 460 * s;
    return [arte.ojos.cx - lado / 2, arte.ojos.cy - 280 * s, lado, lado];
  }
  // Lo más alto que puede llegar un accesorio; si se sale del lienzo, se amplía hacia arriba.
  const tope = arte.ojos.cy - (170 + ALTO_SOBRE_CABEZA) * s;
  const pad = Math.max(0, Math.ceil(-tope));
  return [0, -pad, arte.ancho, arte.alto + pad];
}

export function componerAvatar(
  svgBase: string,
  arte: Arte,
  config: Pick<AvatarConfig, 'tono' | 'pelo' | 'accesorio'>,
  encuadre: Encuadre = 'cuerpo'
): string {
  let svg = svgBase;
  const tono = TONOS_PIEL.find((t) => t.id === config.tono)?.hex;
  if (tono) svg = recolorearFamilia(svg, arte.piel, tono);
  const pelo = COLORES_PELO.find((c) => c.id === config.pelo)?.hex;
  if (pelo) svg = recolorearFamilia(svg, arte.pelo, pelo);

  const caja = cajaDe(arte, encuadre)
    .map((n) => n.toFixed(1))
    .join(' ');
  svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${caja}"`);
  if (encuadre === 'retrato') svg = svg.replace(/<ellipse id="sombra-piso"[^>]*\/>/, '');
  if (config.accesorio) {
    svg = svg.replace(/<\/svg>\s*$/, `${dibujoDeAccesorio(config.accesorio, arte.ojos)}</svg>`);
  }
  return svg;
}
