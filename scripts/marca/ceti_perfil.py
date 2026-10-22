"""Ceti de perfil, redibujada por piezas (no por manchas de color) para el salto del portal.

Toma la pose recta de la hoja de Gemini (assets/brand/bocetos/ceti-06-salto-poses-limpia.png, pose 1: cabeza
arriba, panza a la derecha) y saca cada pieza con la forma que le corresponde:
  - silueta: un solo contorno cerrado y suave (relleno naranja + contorno café parejo)
  - panza: contorno cerrado suave (crema)
  - líneas: mandíbula, aleta, ceja y surcos de la panza como trazos de grosor parejo (esqueleto de la línea)
  - ojo: círculos exactos (blanco, pupila, brillo); mejilla: elipse
Salida: assets/brand/ceti/salto/ceti-perfil.json (puntos en px de la hoja) y ceti-perfil.svg (vista previa).
La animación (scripts/lottie/ceti-personaje.mjs) curva estas piezas a lo largo de la columna cuadro a cuadro.

Uso (desde scripts/marca): ~/.venvs/mascot/bin/python ceti_perfil.py
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.morphology import skeletonize

RAIZ = Path(__file__).resolve().parents[2]
SRC = RAIZ / 'assets/brand/bocetos/ceti-06-salto-poses-limpia.png'
BOX = (85, 40, 255, 485)
UP = 4
OUT = RAIZ / 'assets/brand/ceti/salto'

COL = {
    'naranja': '#FB6611', 'contorno': '#B9461A', 'panza': '#F8DBA8', 'surco': '#DDB27E',
    'linea': '#C9480F', 'ojo': '#FFFFFF', 'pupila': '#6E2A2C', 'mejilla': '#FB8F6A', 'ceja': '#B9461A',
}


def cargar():
    im = Image.open(SRC).convert('RGB').crop(BOX)
    im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS)
    return np.asarray(im).astype(np.int32)


def dist(a, c):
    return np.sqrt(((a - np.array(c)) ** 2).sum(-1))


def contorno_suave(mask, n, sigma=2.0):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea).reshape(-1, 2).astype(float)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(np.r_[c, c[:1]], axis=0).T))]
    s = np.linspace(0, seg[-1], n, endpoint=False)
    q = np.c_[np.interp(s, seg, np.r_[c[:, 0], c[0, 0]]), np.interp(s, seg, np.r_[c[:, 1], c[0, 1]])]
    k = np.arange(-3 * int(np.ceil(sigma)), 3 * int(np.ceil(sigma)) + 1)
    w = np.exp(-k ** 2 / (2 * sigma ** 2)); w /= w.sum()
    return sum(wi * np.roll(q, -ki, axis=0) for ki, wi in zip(k, w))


def caminos(skel, min_len=25):
    """Esqueleto -> lista de polilíneas ordenadas (el camino más largo de cada componente)."""
    out = []
    lab, n = ndimage.label(skel, structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        pts = np.argwhere(lab == i)
        if len(pts) < min_len:
            continue
        idx = {tuple(p): j for j, p in enumerate(pts)}
        vec = lambda p: [idx[(p[0] + dy, p[1] + dx)] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                         if (dy or dx) and (p[0] + dy, p[1] + dx) in idx]
        adj = [vec(p) for p in pts]

        def bfs(s):
            d = {s: 0}; prev = {s: None}; cola = [s]
            for u in cola:
                for v in adj[u]:
                    if v not in d:
                        d[v] = d[u] + 1; prev[v] = u; cola.append(v)
            far = max(d, key=d.get)
            return far, prev
        a, _ = bfs(0)
        b, prev = bfs(a)
        path = []
        u = b
        while u is not None:
            path.append(pts[u][::-1]); u = prev[u]
        out.append(np.array(path, float))
    return out


def suavizar_linea(p, paso=10, sigma=1.5):
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    n = max(4, int(seg[-1] / paso))
    s = np.linspace(0, seg[-1], n)
    q = np.c_[np.interp(s, seg, p[:, 0]), np.interp(s, seg, p[:, 1])]
    if sigma > 0 and n > 6:
        q2 = ndimage.gaussian_filter1d(q, sigma, axis=0, mode='nearest')
        q2[0], q2[-1] = q[0], q[-1]
        q = q2
    return q


def main():
    a = cargar()
    H, W = a.shape[:2]
    fondo = (a.min(-1) > 226)
    figura = ndimage.binary_fill_holes(~fondo)
    lab, n = ndimage.label(figura)
    figura = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    figura = ndimage.binary_opening(figura, iterations=2)

    def mayor(m, abrir=2):
        m = ndimage.binary_opening(m, iterations=abrir) if abrir else m
        lab, n = ndimage.label(m)
        return lab == (np.bincount(lab.ravel())[1:].argmax() + 1) if n else m

    oscuro = (a[..., 0] < 225) & (a[..., 1] < 120) & figura          # contorno y líneas café/naranja oscuro
    crema = (dist(a, (248, 219, 168)) < 38) & figura
    surco_c = (dist(a, (215, 180, 130)) < 32) & figura
    # La panza es la crema y los surcos juntos (los surcos la parten en franjas).
    panza = mayor(ndimage.binary_closing(crema | surco_c, iterations=3), 3)
    panza = ndimage.binary_fill_holes(panza)
    panza0 = panza.copy()
    # La crema llega hasta el contorno (sin franja naranja entre panza y borde).
    panza = ndimage.binary_dilation(panza, iterations=int(3 * UP)) & ndimage.binary_erosion(figura, iterations=int(UP))
    surco = surco_c & ndimage.binary_erosion(panza, iterations=int(2 * UP))
    blanco = mayor((a.min(-1) > 235) & figura & ~panza, 3)          # blanco del ojo
    pupila = mayor((dist(a, (118, 40, 52)) < 55) & figura & ndimage.binary_dilation(blanco, iterations=25), 1)
    mejilla = mayor((dist(a, (250, 140, 105)) < 40) & figura, 3)

    # Grosor del contorno: el anillo oscuro pegado al borde de la figura.
    dt = ndimage.distance_transform_edt(figura)
    anillo = oscuro & (dt < 14 * UP / 4)
    grosor = float(np.median(dt[anillo])) * 2 if anillo.any() else 6.0

    sil = contorno_suave(figura, 700, sigma=1.0)
    pan = contorno_suave(panza, 220, sigma=1.5)

    # Líneas interiores: lo oscuro que no es el contorno exterior, ni el aro del ojo, ni el borde de la panza
    # por debajo de la mandíbula (ahí la referencia no tiene línea, es solo el cambio de color).
    ys = np.nonzero(pupila)[0]
    y_mandibula = (ys.max() + 30 * UP / 4) if len(ys) else 0
    yy = np.mgrid[:H, :W][0]
    borde_panza = ndimage.binary_dilation(panza0, iterations=int(4 * UP)) & ~ndimage.binary_erosion(panza0, iterations=int(2 * UP))
    interior = oscuro & (dt > grosor * 1.4) & ~ndimage.binary_dilation(blanco | pupila, iterations=int(8 * UP))
    interior &= ~(borde_panza & (yy > y_mandibula))
    interior &= yy < H * 0.8                                          # en la cola solo hay contorno
    lineas = [suavizar_linea(p) for p in caminos(skeletonize(ndimage.binary_closing(interior, iterations=1)), 40)]

    # Surcos: curvas a lo ancho de la panza (fracción medida en la referencia), como las dibuja Ceti, en vez de
    # calcar los píxeles (salían cortados). Van de un poco bajo la mandíbula hasta cerca de la punta de la panza.
    filas = [y for y in range(H) if panza0[y].any()]
    izq = {y: np.nonzero(panza0[y])[0].min() for y in filas}
    der = {y: np.nonzero(panza0[y])[0].max() for y in filas}
    fr = []
    for y in filas[len(filas) // 4: 3 * len(filas) // 4: 4]:
        xs = np.nonzero(surco[y])[0]
        w = der[y] - izq[y]
        if w > 20:
            fr += [(x - izq[y]) / w for x in xs]
    # Ceti tiene tres surcos repartidos a lo ancho de la panza (fracciones fijas, como en la referencia).
    fracciones = [0.28, 0.54, 0.79]
    lado = lambda d: ndimage.gaussian_filter1d(np.array([d[y] for y in filas], float), 12 * UP / 4)
    izq = dict(zip(filas, lado(izq)))
    der = dict(zip(filas, lado(der)))
    y0, y1 = filas[0] + (filas[-1] - filas[0]) * 0.12, filas[-1] - (filas[-1] - filas[0]) * 0.04
    surcos = []
    for f in fracciones:
        pts_s = [(izq[y] + f * (der[y] - izq[y]), y) for y in filas if y0 <= y <= y1]
        surcos.append(suavizar_linea(np.array(pts_s, float), 14, 3))

    def circulo(m):
        lab, n = ndimage.label(m)
        if n == 0:
            return None
        i = np.bincount(lab.ravel())[1:].argmax() + 1
        ys, xs = np.nonzero(lab == i)
        return [float(xs.mean()), float(ys.mean()), float(np.sqrt(len(xs) / np.pi))]

    def envolvente(m):
        cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        (x, y), r = cv2.minEnclosingCircle(max(cs, key=cv2.contourArea))
        return [float(x), float(y), float(r)]

    # El ojo es el círculo que envuelve blanco + pupila; la pupila, el que envuelve lo oscuro (con su brillo).
    ojo = envolvente(ndimage.binary_fill_holes(blanco | pupila))
    pup = envolvente(ndimage.binary_fill_holes(pupila))
    brillo = None
    if pup:
        cx, cy, r = pup
        yy2, xx = np.mgrid[:H, :W]
        brillo = circulo((a.min(-1) > 235) & ((xx - cx) ** 2 + (yy2 - cy) ** 2 < (r * 0.95) ** 2))
    mj = None
    if mejilla.any():
        cs, _ = cv2.findContours(mejilla.astype(np.uint8), 0, 1)
        (ex, ey), (ew, eh), ang = cv2.fitEllipse(max(cs, key=len))
        mj = [ex, ey, ew / 2, eh / 2, ang]

    if ojo:
        ox, oy, orad = ojo
        lineas = [l for l in lineas if not (np.hypot(*(l.mean(0) - [ox, oy])) < 2.6 * orad and l.mean(0)[0] > ox)]
    esc = 1 / UP
    pts = lambda p: [[round(x * esc, 2), round(y * esc, 2)] for x, y in p]
    datos = {
        'origen': 'pose 1 de ceti-06-salto-poses-limpia.png, caja %s' % (BOX,),
        'colores': COL,
        'contorno': round(grosor * esc, 2),
        'silueta': pts(sil), 'panza': pts(pan),
        'lineas': [pts(p) for p in lineas], 'surcos': [pts(p) for p in surcos],
        'ojo': [v * esc for v in ojo] if ojo else None,
        'pupila': [v * esc for v in pup] if pup else None,
        'brillo': [v * esc for v in brillo] if brillo else None,
        'mejilla': [mj[0] * esc, mj[1] * esc, mj[2] * esc, mj[3] * esc, mj[4]] if mj else None,
        'tam': [W * esc, H * esc],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'ceti-perfil.json').write_text(json.dumps(datos, indent=1))
    (OUT / 'ceti-perfil.svg').write_text(svg(datos))
    print('líneas', len(lineas), 'surcos', len(surcos), 'contorno', datos['contorno'], 'ojo', ojo is not None, 'pupila', pup is not None)


def cat(p, cerrado):
    p = np.asarray(p, float)
    n = len(p)
    f = lambda v: f'{v[0]:.2f} {v[1]:.2f}'
    if cerrado:
        out = [f'M{f(p[0])}']
        for i in range(n):
            p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
            out.append(f'C{f(p1 + (p2 - p0) / 6)} {f(p2 - (p3 - p1) / 6)} {f(p2)}')
        return ''.join(out) + 'Z'
    q = np.vstack([p[0], p, p[-1]])
    out = [f'M{f(q[1])}']
    for i in range(1, n):
        p0, p1, p2, p3 = q[i - 1], q[i], q[i + 1], q[i + 2]
        out.append(f'C{f(p1 + (p2 - p0) / 6)} {f(p2 - (p3 - p1) / 6)} {f(p2)}')
    return ''.join(out)


def svg(d):
    c = d['colores']; w = d['contorno']
    W, H = d['tam']
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}">']
    o.append(f'<path d="{cat(d["silueta"], True)}" fill="{c["naranja"]}"/>')
    o.append(f'<path d="{cat(d["panza"], True)}" fill="{c["panza"]}"/>')
    for s in d['surcos']:
        o.append(f'<path d="{cat(s, False)}" fill="none" stroke="{c["surco"]}" stroke-width="{w * 0.55:.2f}" stroke-linecap="round"/>')
    if d['mejilla']:
        x, y, rx, ry, a = d['mejilla']
        o.append(f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{c["mejilla"]}" transform="rotate({a:.1f} {x:.2f} {y:.2f})"/>')
    for l in d['lineas']:
        o.append(f'<path d="{cat(l, False)}" fill="none" stroke="{c["linea"]}" stroke-width="{w * 0.85:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    for k, col in (('ojo', 'ojo'), ('pupila', 'pupila'), ('brillo', 'ojo')):
        if d[k]:
            x, y, r = d[k]
            o.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{c[col]}"/>')
    o.append(f'<path d="{cat(d["silueta"], True)}" fill="none" stroke="{c["contorno"]}" stroke-width="{w:.2f}" stroke-linejoin="round"/>')
    o.append('</svg>\n')
    return ''.join(o)


if __name__ == '__main__':
    main()
