"""Casos sintéticos del banco (verdad vectorial exacta), deterministas con semilla fija.

degradar(): rasteriza un SVG de marca (la verdad), le dibuja un contorno marrón tipo boceto Gemini
            sobre las fronteras entre colores, desenfoca, reduce y guarda como JPEG.
estres():   genera un SVG de estrés (líneas paralelas finas, degradado radial, 5 colores con ΔE 4–8)
            y su versión degradada.
Salidas en ~/.cache/vectorizar/banco/<id>/: entrada.jpg (lo que ve el vectorizador), verdad.png
(la verdad renderizada al tamaño de la entrada), linea.png (zona de contorno añadido: el color allí
no se puntúa) y verdad.svg (copia de la verdad). Se regeneran si faltan; nada de esto va al repo.

Uso: python -m vectorizar.banco.sinteticos  (o importado por puntaje.py)
"""
import io
import json
import shutil
from pathlib import Path

import cairosvg
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CACHE = Path.home() / '.cache/vectorizar/banco'
SS = 4  # supersampling para dibujar el contorno con antialias


def _png(svg_text, w, h, fondo, crisp=False):
    if crisp:
        svg_text = svg_text.replace('<svg ', '<svg shape-rendering="crispEdges" ', 1)
    png = cairosvg.svg2png(bytestring=svg_text.encode(), output_width=w, output_height=h,
                           background_color='#' + fondo)
    return np.asarray(Image.open(io.BytesIO(png)).convert('RGB'))


def _lab(rgb):
    out = cv2.cvtColor(np.ascontiguousarray(rgb, np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    out[..., 0] *= 100 / 255
    out[..., 1:] -= 128
    return out


def _hex(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def _viewbox(svg):
    import re
    vb = re.search(r'viewBox="([^"]*)"', svg).group(1).split()
    return int(round(float(vb[2]))), int(round(float(vb[3])))


def contorno(svg, w, h, fondo, ancho, de_min=10.0, fino=8.0):
    """Máscara (a SS×) de un contorno tipo boceto de `ancho` px (a 1×).

    Las bandas de borde de la verdad (regiones de < `fino` px de ancho, más oscuras y de tono parecido
    al relleno que rodean: el "tono oscuro del dueño" del estilo de marca) se vuelven línea marrón y se
    ensanchan hasta `ancho` desde su eje; entre regiones gruesas el contorno va centrado en la frontera.
    Así sale una sola línea por borde, como en los bocetos Gemini, y no líneas dobles.
    """
    from skimage.morphology import skeletonize
    W, H = w * SS, h * SS
    crisp = _png(svg, W, H, fondo, crisp=True)
    L = _lab(crisp)
    cod = (crisp[..., 0].astype(np.int32) << 16) | (crisp[..., 1].astype(np.int32) << 8) | crisp[..., 2]
    r = int(round(fino * SS / 2))
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    fino_m = np.zeros((H, W), bool)
    for c in np.unique(cod):
        m = (cod == c).astype(np.uint8)
        if m.sum() > 0.3 * H * W:      # el fondo
            continue
        fino_m |= (m > 0) & (cv2.morphologyEx(m, cv2.MORPH_OPEN, disco) == 0)
    # de lo fino, solo es "borde" lo que es más oscuro y parecido al relleno grueso que lo rodea
    borde = np.zeros((H, W), bool)
    cc, n = ndi.label(fino_m, np.ones((3, 3)))
    pad = 3 * SS
    for i, sl in enumerate(ndi.find_objects(cc), 1):
        y0, y1 = max(0, sl[0].start - pad), min(H, sl[0].stop + pad)
        x0, x1 = max(0, sl[1].start - pad), min(W, sl[1].stop + pad)
        comp = cc[y0:y1, x0:x1] == i
        anillo = ndi.binary_dilation(comp, iterations=2 * SS) & ~fino_m[y0:y1, x0:x1]
        if not anillo.any():
            continue
        Ls = L[y0:y1, x0:x1]
        lc = np.median(Ls[comp], 0)
        cods, cnt = np.unique(cod[y0:y1, x0:x1][anillo], return_counts=True)
        vec = Ls[anillo][cod[y0:y1, x0:x1][anillo] == cods[np.argmax(cnt)]][0]
        if lc[0] < vec[0] - 3 and np.sqrt(((lc - vec) ** 2).sum()) < 35:
            borde[y0:y1, x0:x1] |= comp
    fr = np.zeros((H, W), bool)
    for ax in (0, 1):
        d = np.sqrt(((np.diff(L, axis=ax)) ** 2).sum(-1)) > de_min
        if ax == 0:
            d &= ~borde[:-1] & ~borde[1:]
            fr[:-1] |= d
            fr[1:] |= d
        else:
            d &= ~borde[:, :-1] & ~borde[:, 1:]
            fr[:, :-1] |= d
            fr[:, 1:] |= d
    eje = skeletonize(borde)
    dist = ndi.distance_transform_edt(~(fr | eje))
    return (dist <= (ancho * SS) / 2 - 1) | borde


def degradar(svg_path, salida, escala, linea_hex, ancho=3.0, sigma=0.6, q=78, semilla=1, fondo='FBEFDB',
             ruido=1.5):
    svg = Path(svg_path).read_text()
    w, h = _viewbox(svg)
    W, H = w * SS, h * SS
    big = _png(svg, W, H, fondo).astype(np.float32)
    lin = contorno(svg, w, h, fondo, ancho)
    big[lin] = _hex(linea_hex)
    img = cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA)       # 1×, contorno con antialias
    img = cv2.GaussianBlur(img, (0, 0), sigma)
    wo, ho = int(round(w * escala)), int(round(h * escala))
    img = cv2.resize(img, (wo, ho), interpolation=cv2.INTER_AREA)
    rng = np.random.default_rng(semilla)
    img = np.clip(img + rng.normal(0, ruido, img.shape), 0, 255).astype(np.uint8)
    salida.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img).save(salida / 'entrada.jpg', quality=q, subsampling=2)
    # verdad al tamaño de la entrada (con el mismo fondo)
    Image.fromarray(_png(svg, wo, ho, fondo)).save(salida / 'verdad.png')
    zona = cv2.resize(lin.astype(np.float32), (wo, ho), interpolation=cv2.INTER_AREA) > 0.2
    Image.fromarray((zona * 255).astype(np.uint8)).save(salida / 'linea.png')
    shutil.copy(svg_path, salida / 'verdad.svg')
    return wo, ho


# ------------------------------------------------------------------------------------------- estrés
def _lab2hex(L):
    a = np.array(L, np.float32).reshape(1, 1, 3)
    a[..., 0] *= 255 / 100
    a[..., 1:] += 128
    rgb = cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)[0, 0]
    return ''.join(f'{int(v):02X}' for v in rgb)


def svg_estres(semilla=4):
    """SVG 400×400: franjas finas paralelas, círculo con degradado radial, 5 tonos cercanos y un contorno."""
    rng = np.random.default_rng(semilla)
    p = []
    # 5 colores piel con ΔE 4–8 entre vecinos (en Lab, pasos fijos + jitter pequeño con semilla)
    base = np.array([72.0, 18.0, 24.0])
    pasos = [np.array([0, 0, 0])]
    for _ in range(4):
        dlt = rng.uniform(-1, 1, 3)
        dlt = dlt / np.linalg.norm(dlt) * rng.uniform(4.5, 7.5)
        pasos.append(pasos[-1] + dlt)
    tonos = [_lab2hex(base + d) for d in pasos]
    # panel de franjas (líneas oscuras de 2 y 3 px sobre claro), giradas 30°
    p.append('<path d="M20 20 L190 20 L190 190 L20 190 Z" fill="#E8F1EC"/>')
    ang = np.deg2rad(30)
    dx, dy = np.cos(ang), np.sin(ang)
    y = 20.0
    k = 0
    while y < 400:
        wl = 2.0 if k % 2 == 0 else 3.0
        # franja = paralelogramo recortado al panel aproximando con un polígono grande y clip manual
        x0, y0 = 20, y
        pts = []
        for t in np.linspace(0, 300, 2):
            pts.append((x0 + t * dx, y0 - t * dy))
        (ax, ay), (bx, by) = pts
        nx, ny = dy, dx  # normal
        poly = [(ax, ay), (bx, by), (bx + nx * wl, by + ny * wl), (ax + nx * wl, ay + ny * wl)]
        poly = _clip(poly, 20, 20, 190, 190)
        if len(poly) >= 3:
            p.append('<path d="M' + ' L'.join(f'{u:.2f} {v:.2f}' for u, v in poly) + ' Z" fill="#2E5D5A"/>')
        y += 6.0 + (k % 3)
        k += 1
    # degradado radial (la verdad sí lo usa: el vectorizador debe aproximarlo con bandas)
    p.append('<defs><radialGradient id="g" cx="0.4" cy="0.4" r="0.6"><stop offset="0" stop-color="#FFE08A"/>'
             '<stop offset="1" stop-color="#E86A1C"/></radialGradient></defs>')
    p.append('<circle cx="300" cy="105" r="85" fill="url(#g)"/>')
    # 5 tonos cercanos en bandas onduladas (fronteras curvas de bajo contraste)
    for i, t in enumerate(tonos):
        y0 = 215 + i * 33
        y1 = 385  # cada banda baja hasta el final: la siguiente la tapa (sin huecos)
        top = ' '.join(f'L{x:.1f} {y0 + 6 * np.sin(x / 23 + i):.1f}' for x in np.linspace(20, 380, 19))
        p.append(f'<path d="M20 {y1} {top} L380 {y1} Z" fill="#{t}"/>')
    # contorno de marca alrededor del bloque de tonos (trazo uniforme 3 px)
    p.append('<path d="M20 215 L380 215 L380 385 L20 385 Z" fill="none" stroke="#7A3E2B" stroke-width="3"/>')
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' + ''.join(p) + '</svg>'
    return svg, tonos


def _clip(poly, x0, y0, x1, y1):
    """Sutherland–Hodgman contra un rectángulo."""
    def cortar(pts, dentro, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if dentro(b):
                if not dentro(a):
                    out.append(inter(a, b))
                out.append(b)
            elif dentro(a):
                out.append(inter(a, b))
        return out

    def ix(xc):
        return lambda a, b: (xc, a[1] + (b[1] - a[1]) * (xc - a[0]) / (b[0] - a[0]))

    def iy(yc):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1]), yc)

    for dentro, inter in ((lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)),
                          (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1))):
        poly = cortar(poly, dentro, inter)
        if not poly:
            break
    return poly


def estres(salida, escala=0.5, sigma=0.6, q=75, semilla=4, fondo='FBEFDB', ruido=1.5):
    svg, tonos = svg_estres(semilla)
    salida.mkdir(parents=True, exist_ok=True)
    (salida / 'verdad.svg').write_text(svg)
    w, h = _viewbox(svg)
    # se dibuja a 2× y se reduce al 50 %: la entrada queda de 400×400 con franjas de 2–3 px
    big = _png(svg, 2 * w, 2 * h, fondo).astype(np.float32)
    big = cv2.GaussianBlur(big, (0, 0), sigma * 2)
    wo, ho = int(round(2 * w * escala)), int(round(2 * h * escala))
    img = cv2.resize(big, (wo, ho), interpolation=cv2.INTER_AREA)
    rng = np.random.default_rng(semilla)
    img = np.clip(img + rng.normal(0, ruido, img.shape), 0, 255).astype(np.uint8)
    Image.fromarray(img).save(salida / 'entrada.jpg', quality=q, subsampling=2)
    Image.fromarray(_png(svg, wo, ho, fondo)).save(salida / 'verdad.png')
    Image.fromarray(np.zeros((ho, wo), np.uint8)).save(salida / 'linea.png')
    (salida / 'tonos.json').write_text(json.dumps(tonos))
    return wo, ho


def generar(caso, raiz, forzar=False):
    """Genera (si falta) el caso sintético `caso` (dict de casos.json). Devuelve la carpeta."""
    g = caso['generador']
    d = CACHE / caso['id']
    marca = d / 'generador.json'
    if not forzar and marca.exists() and json.loads(marca.read_text()) == g and (d / 'entrada.jpg').exists():
        return d
    if g['fn'] == 'degradar':
        degradar(Path(raiz) / g['svg'], d, g['escala'], g['linea_hex'], g.get('ancho', 3.0), g.get('sigma', 0.6),
                 g.get('q', 78), g.get('semilla', 1), caso['fondo'], g.get('ruido', 1.5))
    elif g['fn'] == 'estres':
        estres(d, g.get('escala', 0.5), g.get('sigma', 0.6), g.get('q', 75), g.get('semilla', 4), caso['fondo'],
               g.get('ruido', 1.5))
    else:
        raise ValueError(g['fn'])
    marca.write_text(json.dumps(g))
    return d


if __name__ == '__main__':
    import sys
    raiz = Path(__file__).resolve().parents[4]
    casos = json.loads((Path(__file__).parent / 'casos.json').read_text())['casos']
    for c in casos:
        if c.get('generador'):
            print(c['id'], generar(c, raiz, forzar='--forzar' in sys.argv))
