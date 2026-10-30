"""Arma el logo de Ceti (cara, propuesta 2) desde el SVG del vectorizador.

Gemini dibujó la cara unos 6 px a la derecha del cuerpo, así que la barriga quedaba corrida. Aquí:
- el cuerpo, la barriga y la sonrisa se vuelven simétricos (se refleja su mitad izquierda);
- las piezas de la cara (ojos, cejas, cachetes, sonrisa, barriga, surcos) se centran en el eje del ícono;
- se recorta al cuadrado redondeado exacto (logo) o al cuadrado a sangre (ícono de app).

Uso (desde scripts/marca):
  ~/.venvs/mascot/bin/python -m vectorizar ceti-logo -o ~/.cache/vectorizar/ceti-logo.svg --solo-retoques
  ~/.venvs/mascot/bin/python logo/armar_logo.py ~/.cache/vectorizar/ceti-logo.svg ../../assets/brand/logo
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from skimage import measure

EJE = 144.0          # centro del ícono (viewBox 4 4.5 280 280)
DX_CARA = -6.0       # la cara está centrada en ~150
K = 8                # sobremuestreo para reflejar formas
LADO = 300
FONDO = '#F88125'
CARA = (55, 118, 245, 300)  # zona donde viven las piezas de la cara


def subtrazos(d):
    return [s for s in re.split(r'(?=M)', d.strip()) if s]


def puntos(sub, pasos=12):
    """Aplana un subtrazo (solo M L C Q Z absolutos) a una polilínea."""
    toks = re.findall(r'[MLCQZ]|-?\d+\.?\d*', sub)
    pts, i, cmd, cur = [], 0, None, (0, 0)
    while i < len(toks):
        t = toks[i]
        if t in 'MLCQZ':
            cmd = t
            i += 1
            if t == 'Z':
                continue
            continue
        n = {'M': 2, 'L': 2, 'C': 6, 'Q': 4}[cmd]
        v = list(map(float, toks[i:i + n]))
        i += n
        if cmd in 'ML':
            cur = (v[0], v[1])
            pts.append(cur)
        elif cmd == 'C':
            p0, p1, p2, p3 = cur, v[0:2], v[2:4], v[4:6]
            for k in range(1, pasos + 1):
                u = k / pasos
                pts.append(tuple((1 - u) ** 3 * np.array(p0) + 3 * (1 - u) ** 2 * u * np.array(p1)
                                 + 3 * (1 - u) * u ** 2 * np.array(p2) + u ** 3 * np.array(p3)))
            cur = tuple(p3)
        elif cmd == 'Q':
            p0, p1, p2 = cur, v[0:2], v[2:4]
            for k in range(1, pasos + 1):
                u = k / pasos
                pts.append(tuple((1 - u) ** 2 * np.array(p0) + 2 * (1 - u) * u * np.array(p1) + u ** 2 * np.array(p2)))
            cur = tuple(p2)
    return pts


def caja(pts):
    a = np.array(pts)
    return a[:, 0].min(), a[:, 1].min(), a[:, 0].max(), a[:, 1].max()


def mascara(pts):
    im = Image.new('L', (LADO * K, LADO * K), 0)
    ImageDraw.Draw(im).polygon([(x * K, y * K) for x, y in pts], fill=255)
    return np.array(im) > 127


def hasta_abajo(m, y=276):
    """Prolonga la forma más allá del borde inferior del ícono: allí la corta el recorte, no el suavizado."""
    m = m.copy()
    f = int(y * K)
    m[f:] = m[f]
    return m


def simetrica(m, eje_origen, eje_destino):
    """Refleja la mitad izquierda de la máscara sobre su eje y la centra en eje_destino."""
    c = int(round(eje_origen * K))
    izq = m[:, :c]
    out = np.zeros_like(m)
    d = int(round(eje_destino * K))
    w = min(izq.shape[1], d, out.shape[1] - d)
    out[:, d - w:d] = izq[:, c - w:c]
    out[:, d:d + w] = izq[:, c - w:c][:, ::-1]
    return out


def a_path(m):
    m = nd.gaussian_filter(m.astype(float), 0.6 * K) > 0.5
    d = []
    # borde de ceros: un contorno que toca el borde de la imagen queda abierto y Z lo cerraría en diagonal
    m = np.pad(m, 1)
    for c in measure.find_contours(m.astype(float), 0.5):
        c = c - 1
        if len(c) < 20:
            continue
        c = measure.approximate_polygon(c, tolerance=0.18 * K)
        d.append('M' + 'L'.join(f'{p[1] / K:.2f} {p[0] / K:.2f}' for p in c[:-1]) + 'Z')
    return ''.join(d)


def mover_d(d, dx):
    out, toks, cmd, idx = [], re.findall(r'[MLCQZ]|-?\d+\.?\d*', d), None, 0
    for t in toks:
        if t in 'MLCQZ':
            out.append(t)
            idx = 0
            continue
        v = float(t)
        if idx % 2 == 0:
            v += dx
        idx += 1
        out.append(f'{v:.2f}')
    return re.sub(r' ?([MLCQZ]) ?', r'\1', ' '.join(out))


def en_cara(bb):
    x0, y0, x1, y1 = bb
    return x0 >= CARA[0] and y0 >= CARA[1] and x1 <= CARA[2] and y1 <= CARA[3]


def armar(svg):
    inner = svg[svg.index('>', svg.index('<svg')) + 1:svg.rindex('</svg>')]
    elems = re.findall(r'<(?:path|circle|ellipse)\b[^>]*/>', inner)
    fondo, cara = [], []
    cuerpo = sonrisa = None
    barriga = []  # el motor la partió en 3 por los surcos
    for e in elems:
        fill = re.search(r'fill="([^"]+)"', e)
        fill = fill.group(1) if fill else 'none'
        if e.startswith('<path'):
            d = re.search(r' d="([^"]+)"', e).group(1)
            if fill == 'none':  # trazos (cejas, surcos): todos son de la cara
                cara.append(e.replace(f' d="{d}"', f' d="{mover_d(d, DX_CARA)}"'))
                continue
            resto = []
            for s in subtrazos(d):
                pts = puntos(s)
                bb = caja(pts)
                if fill == '#F66604' and bb[2] - bb[0] > 150 and cuerpo is None:
                    cuerpo = pts
                elif fill == '#F4DFA8' and en_cara(bb) and bb[3] - bb[1] > 60:
                    barriga.append(pts)
                elif fill == '#C54E03' and en_cara(bb) and bb[2] - bb[0] > 80:
                    sonrisa = pts
                elif fill in ('#FFFFFF', '#842F28') and en_cara(bb):
                    cara.append(f'<path d="{mover_d(s, DX_CARA)}" fill="{fill}"/>')
                elif fill == '#832E27':
                    pass  # cejas e iris viejos del motor: los reemplazan los retoques
                else:
                    resto.append(s)
            if resto:
                fondo.append(f'<path d="{"".join(resto)}" fill="{fill}"/>')
        else:
            cx = float(re.search(r'cx="([^"]+)"', e).group(1))
            cy = float(re.search(r'cy="([^"]+)"', e).group(1))
            if fill in ('#FB8544', '#F66604') and CARA[1] < cy < CARA[3] and CARA[0] < cx < CARA[2]:
                cara.append(re.sub(r'cx="[^"]+"', f'cx="{cx + DX_CARA:g}"', e))
            elif fill == '#C54E03' and cy < 118:  # espiráculo: al eje y del tamaño de la referencia
                fondo.append(f'<ellipse cx="{EJE:g}" cy="98" rx="11.5" ry="4.6" fill="#C54E03"/>')
            else:
                fondo.append(e)
    assert cuerpo and barriga and sonrisa, 'no encontré cuerpo, barriga o sonrisa'
    m_barriga = np.zeros((LADO * K, LADO * K), bool)
    for pts in barriga:
        m_barriga |= mascara(pts)
    m_barriga = nd.binary_closing(m_barriga, np.ones((1, 8 * K)))  # cierra las ranuras de los surcos
    xs = np.nonzero(m_barriga.any(axis=0))[0]
    eje_cara = (xs.min() + xs.max()) / 2 / K
    nuevos = [
        f'<path d="{a_path(simetrica(hasta_abajo(mascara(cuerpo)), EJE, EJE))}" fill="#F66604"/>',
        f'<path d="{a_path(simetrica(hasta_abajo(m_barriga), eje_cara, EJE))}" fill="#F4DFA8"/>',
        f'<path d="{a_path(simetrica(mascara(sonrisa), eje_cara, EJE))}" fill="#C54E03"/>',
    ]
    # el espiráculo va encima del cuerpo nuevo
    espiraculo = [e for e in fondo if e.startswith('<ellipse') and '#C54E03' in e]
    fondo = [e for e in fondo if e not in espiraculo]
    # orden: fondo y estrellas, cuerpo, espiráculo, barriga, sonrisa, cara (cachetes, surcos, ojos, cejas)
    return ''.join(fondo + nuevos[:1] + espiraculo + nuevos[1:] + cara)


def envolver(contenido, recorte_id, rx):
    r = f' rx="{rx}"' if rx else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 4.5 280 280" role="img" aria-label="Ceti">\n'
            f'<title>Ceti</title>\n<defs><clipPath id="{recorte_id}"><rect x="4" y="4.5" width="280" height="280"{r}/>'
            f'</clipPath></defs>\n<g clip-path="url(#{recorte_id})"><rect x="4" y="4.5" width="280" height="280" '
            f'fill="{FONDO}"/>{contenido}</g>\n</svg>\n')


if __name__ == '__main__':
    base, destino = Path(sys.argv[1]).expanduser(), Path(sys.argv[2])
    contenido = armar(base.read_text())
    (destino / 'ceti-logo.svg').write_text(envolver(contenido, 'ceti-tile', 52))
    (destino / 'ceti-app-icon.svg').write_text(envolver(contenido, 'ceti-cuadro', 0))
    print('listo', destino)
