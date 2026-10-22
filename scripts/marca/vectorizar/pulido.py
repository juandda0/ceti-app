"""Pulido lógico: rehacer una pieza con la forma que le corresponde, como lo haría un ilustrador.

El motor da un borrador fiel pero "de píxel": una ceja puede salir con el borde ondulado, un cordón con
grosor irregular, una silueta de pelo con bultos, una zona plana con manchas. Estas operaciones toman la
pieza (por color, dentro de una zona del grupo), entienden qué tipo de forma es y la redibujan limpia:

  {"op": "trazo",   "grupo", "zona": [x0, y0, x1, y1], "colores": ["#HEX"], "ancho": "auto"|px, "suavidad": 2}
      algo que es una LÍNEA (cordón, ceja fina, boca, pliegue, contorno interior): esqueleto -> línea central
      suave -> trazo de grosor parejo con puntas redondas. Varias ramas largas -> varios trazos.
  {"op": "silueta", "grupo", "zona", "colores": ["#HEX", ...], "suavidad": 1.5, "huecos": px²}
      una MANCHA de color cuya silueta debe ser continua (pelo, oreja, cara, ropa): quita motas, rellena
      huecos chicos y redibuja el contorno suave con pocos nodos. Un color a la vez, en su mismo lugar de la pila.
  {"op": "elipse_de", "grupo", "zona", "colores": ["#HEX"]}
      rubor, nariz, lunar, botón, ojo pequeño: la mancha pasa a elipse/círculo exacto.
  {"op": "aplanar", "grupo", "zona", "conservar": ["#HEX", ...], "max_area": px²}
      zona que debe ser de un solo tono (cuello, collar, frente): borra las manchas/motas de otros colores
      (subtrazados enteros dentro de la zona, de área < max_area) y deja ver la capa de abajo, que es continua.

Opcional en todas: "color" (color final; por defecto el de la pieza), "pos": "en_lugar" (por defecto, donde
estaba la pieza original), "encima" o "debajo". Coordenadas en px del recorte (rejilla de vectorizar.revisar).
Las piezas originales del mismo color que quedan ENTERAS dentro de la zona se quitan: la zona debe abarcar
la pieza completa.
"""
import io
import math
import re

import cairosvg
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from .retoques import _catmull, _elipse_d, _grupo, _hex, _prim, f

Z = 8  # resolución de trabajo (px por px del recorte)


def _colores_en(frag):
    return sorted({c.upper() for c in re.findall(r'(?:fill|stroke)="(#[0-9A-Fa-f]{6})"', frag)})


def _rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def mascara(svg, gid, zona, colores, z=Z):
    """Render SOLO del grupo dentro de la zona y máscara de los píxeles de `colores` (color más cercano)."""
    _, e, c, _ = _grupo(svg, gid)
    inner = svg[e:c]
    x0, y0, x1, y1 = zona
    doc = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}">' + inner + '</svg>')
    png = cairosvg.svg2png(bytestring=doc.encode(), output_width=int(round((x1 - x0) * z)),
                           output_height=int(round((y1 - y0) * z)))
    im = np.asarray(Image.open(io.BytesIO(png)).convert('RGBA')).astype(np.float32)
    pal = _colores_en(inner)
    P = np.stack([_rgb(p) for p in pal])
    d = ((im[..., None, :3] - P[None, None]) ** 2).sum(-1)
    cls = d.argmin(-1)
    objetivo = [pal.index(_hex(col)) for col in colores if _hex(col) in pal]
    m = np.isin(cls, objetivo) & (im[..., 3] > 127)
    return m


def quitar(frag, zona, colores, max_area=None):
    """Quita subtrazados/primitivas de `colores` enteros dentro de la zona. Devuelve (frag, índice del primero)."""
    cols = {_hex(c) for c in colores} if colores is not None else None
    x0, y0, x1, y1 = zona
    dentro = lambda b: b[0] >= x0 and b[1] >= y0 and b[2] <= x1 and b[3] <= y1
    primero = [None]
    out = []
    pos = 0
    for m in re.finditer(r'<(path|circle|ellipse)\b[^>]*>', frag):
        tag = m.group(0)
        out.append(frag[pos:m.start()])
        pos = m.end()
        col = re.search(r'\s(?:fill|stroke)="(#[0-9A-Fa-f]{6})"', tag)
        col = col.group(1).upper() if col else None
        afecta = cols is None or col in cols
        nuevo = tag
        if afecta:
            if m.group(1) == 'path':
                d = re.search(r'\sd="([^"]*)"', tag).group(1)
                subs = [s for s in re.split(r'(?=M)', d) if s.strip()]
                quedan = []
                for s in subs:
                    nums = [float(v) for v in re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', s)]
                    xs, ys = nums[0::2], nums[1::2]
                    b = (min(xs), min(ys), max(xs), max(ys))
                    chico = max_area is None or (b[2] - b[0]) * (b[3] - b[1]) <= max_area
                    if not (dentro(b) and chico):
                        quedan.append(s)
                if len(quedan) != len(subs):
                    if primero[0] is None:
                        primero[0] = sum(len(x) for x in out)
                    nuevo = '' if not quedan else tag.replace(f'd="{d}"', f'd="{"".join(quedan)}"')
            else:
                g = lambda k: float(re.search(rf'\s{k}="([^"]+)"', tag).group(1))
                rx = g('r') if m.group(1) == 'circle' else g('rx')
                ry = g('r') if m.group(1) == 'circle' else g('ry')
                b = (g('cx') - rx, g('cy') - ry, g('cx') + rx, g('cy') + ry)
                if dentro(b) and (max_area is None or 4 * rx * ry <= max_area):
                    if primero[0] is None:
                        primero[0] = sum(len(x) for x in out)
                    nuevo = ''
        out.append(nuevo)
    out.append(frag[pos:])
    return ''.join(out), primero[0]



def _reemplazar(svg, gid, zona, colores, nuevo, pos='en_lugar', max_area=None):
    s, e, c, _ = _grupo(svg, gid)
    frag, i = quitar(svg[e:c], zona, colores, max_area)
    if pos == 'debajo':
        frag = nuevo + frag
    elif pos == 'encima' or i is None:
        frag = frag + nuevo
    else:
        frag = frag[:i] + nuevo + frag[i:]
    return svg[:e] + frag + svg[c:]


def _limpiar(m, z, huecos=None, min_area=4.0):
    m = ndi.binary_opening(m, iterations=max(1, z // 4))
    cc, n = ndi.label(m)
    if n:
        tam = ndi.sum(m, cc, range(1, n + 1))
        m = np.isin(cc, np.where(tam >= min_area * z * z)[0] + 1)
    if huecos:
        h = ndi.binary_fill_holes(m) & ~m
        cc, n = ndi.label(h)
        if n:
            tam = ndi.sum(h, cc, range(1, n + 1))
            m |= np.isin(cc, np.where(tam <= huecos * z * z)[0] + 1)
    return m


def silueta_d(m, zona, z, suavidad=1.5):
    import potrace
    x0, y0 = zona[0], zona[1]
    if suavidad:
        m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), suavidad * z) > 0.5
    bm = potrace.Bitmap(~m)
    plist = bm.trace(turdsize=int(4 * z * z), alphamax=1.15, opticurve=True, opttolerance=0.35 * z)
    q = lambda p: f'{f(x0 + p.x / z)} {f(y0 + p.y / z)}'
    out = []
    for curve in plist:
        d = [f'M{q(curve.start_point)}']
        for seg in curve.segments:
            d.append(f'L{q(seg.c)}L{q(seg.end_point)}' if seg.is_corner
                     else f'C{q(seg.c1)} {q(seg.c2)} {q(seg.end_point)}')
        out.append(''.join(d) + 'Z')
    return ''.join(out)


def trazos(m, zona, z, ancho='auto', suavidad=2.0, min_largo=6.0):
    """Máscara de algo lineal -> lista de (puntos, ancho) por rama larga del esqueleto."""
    from skan import Skeleton
    from skimage.morphology import skeletonize
    from skimage.measure import approximate_polygon
    x0, y0 = zona[0], zona[1]
    dt = ndi.distance_transform_edt(m)
    sk = skeletonize(m)
    if not sk.any():
        return []
    S = Skeleton(sk)
    w_auto = 2 * float(np.median(dt[sk])) / z
    out = []
    # ramas: se unen las rutas del grafo en cadenas largas (las espigas cortas se descartan)
    for i in range(S.n_paths):
        co = S.path_coordinates(i).astype(float)
        largo = np.hypot(*np.diff(co, axis=0).T).sum() / z
        if largo < max(min_largo, 1.5 * w_auto):
            continue
        sig = suavidad * z
        co = np.stack([ndi.gaussian_filter1d(co[:, 0], sig, mode='nearest'),
                       ndi.gaussian_filter1d(co[:, 1], sig, mode='nearest')], 1)
        poly = approximate_polygon(co, 0.25 * z)
        pts = [(x0 + c / z, y0 + r / z) for r, c in poly]
        out.append((pts, w_auto if ancho == 'auto' else float(ancho)))
    return out


def aplicar_op(svg, r, log=print):
    op = r['op']
    gid = r.get('grupo', 'cuerpo')
    zona = r['zona']
    pos = r.get('pos', 'en_lugar')
    if op == 'aplanar':
        s, e, c, _ = _grupo(svg, gid)
        cons = {_hex(x) for x in r.get('conservar', [])}
        quitar_cols = [x for x in _colores_en(svg[e:c]) if x not in cons]
        frag, _ = quitar(svg[e:c], zona, quitar_cols, r.get('max_area', 400))
        return svg[:e] + frag + svg[c:]
    colores = r['colores']
    if op == 'silueta':
        for col in colores:
            m = _limpiar(mascara(svg, gid, zona, [col]), Z, r.get('huecos', 30))
            d = silueta_d(m, zona, Z, r.get('suavidad', 1.5))
            if d:
                svg = _reemplazar(svg, gid, zona, [col], f'<path d="{d}" fill="{_hex(r.get("color", col))}"/>', pos)
        return svg
    m = _limpiar(mascara(svg, gid, zona, colores), Z, r.get('huecos'))
    color = _hex(r.get('color', colores[0]))
    if op == 'trazo':
        nuevo = ''.join(
            f'<path d="{_catmull(pts, False)}" fill="none" stroke="{color}" stroke-width="{f(w)}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
            for pts, w in trazos(m, zona, Z, r.get('ancho', 'auto'), r.get('suavidad', 2.0)))
    elif op == 'elipse_de':
        cnt, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        nuevo = ''
        for c in cnt:
            if len(c) < 6 or cv2.contourArea(c) < 2 * Z * Z:
                continue
            (cx, cy), (w, h), a = cv2.fitEllipse(c)
            cx, cy = zona[0] + cx / Z, zona[1] + cy / Z
            rx, ry = (w + 1) / 2 / Z, (h + 1) / 2 / Z
            if abs(rx - ry) / max(rx, ry) < 0.06:
                nuevo += _prim(cx, cy, (rx + ry) / 2, (rx + ry) / 2, color)
            elif min(a % 180, 180 - a % 180) < 3:
                nuevo += _prim(cx, cy, rx, ry, color)
            elif abs(a % 180 - 90) < 3:
                nuevo += _prim(cx, cy, ry, rx, color)
            else:
                nuevo += f'<path d="{_elipse_d(cx, cy, rx, ry, a)}" fill="{color}"/>'
    else:
        raise ValueError(f'pulido: operación desconocida {op}')
    if not nuevo:
        log(f'  {op}: no encontré la pieza ({colores}) en {zona}')
        return svg
    return _reemplazar(svg, gid, zona, colores, nuevo, pos)


OPS = {'trazo', 'silueta', 'elipse_de', 'aplanar'}


def colores_zona(svg, gid, zona, z=4):
    """[(HEX, px² del recorte)] de los colores visibles del grupo en la zona: para saber qué color es cada pieza."""
    _, e, c, _ = _grupo(svg, gid)
    pal = _colores_en(svg[e:c])
    out = []
    for p in pal:
        n = mascara(svg, gid, zona, [p], z).sum() / (z * z)
        if n >= 1:
            out.append((p, round(float(n), 1)))
    return sorted(out, key=lambda t: -t[1])


if __name__ == '__main__':
    import sys
    # uso: python -m vectorizar.pulido <svg> <grupo> x0,y0,x1,y1
    s = open(sys.argv[1]).read()
    for h, n in colores_zona(s, sys.argv[2], [float(v) for v in sys.argv[3].split(',')]):
        print(h, n)
