"""Geometría de los planetas de Ceti: círculos, elipses giradas y monedas como trazados SVG.

Contrato animable (el mismo de los personajes): solo <g>, <path>, <circle> y <ellipse>, sin `transform`,
`d` solo con M L C Z absolutos y color #RRGGBB en cada forma. Por eso las elipses giradas y los arcos se
escriben como cúbicas.
"""
from __future__ import annotations

import math

Punto = tuple[float, float]


def f(v: float) -> str:
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


def pt(p: Punto) -> str:
    return f'{f(p[0])} {f(p[1])}'


class Elipse:
    """Elipse de centro `c`, semiejes `rx` (sobre el ángulo `giro`, en grados) y `ry`."""

    def __init__(self, c: Punto, rx: float, ry: float, giro: float = 0.0):
        self.c, self.rx, self.ry, self.giro = c, rx, ry, math.radians(giro)

    def punto(self, t: float) -> Punto:
        x, y = self.rx * math.cos(t), self.ry * math.sin(t)
        cg, sg = math.cos(self.giro), math.sin(self.giro)
        return (self.c[0] + x * cg - y * sg, self.c[1] + x * sg + y * cg)

    def derivada(self, t: float) -> Punto:
        x, y = -self.rx * math.sin(t), self.ry * math.cos(t)
        cg, sg = math.cos(self.giro), math.sin(self.giro)
        return (x * cg - y * sg, x * sg + y * cg)

    def arco(self, t1: float, t2: float) -> str:
        """Segmentos C del arco de t1 a t2 (sin el M inicial), en tramos de 90° como máximo."""
        n = max(1, math.ceil(abs(t2 - t1) / (math.pi / 2) - 1e-9))
        out, dt = [], (t2 - t1) / n
        for i in range(n):
            a, b = t1 + i * dt, t1 + (i + 1) * dt
            k = 4 / 3 * math.tan((b - a) / 4)
            pa, pb, da, db = self.punto(a), self.punto(b), self.derivada(a), self.derivada(b)
            c1 = (pa[0] + k * da[0], pa[1] + k * da[1])
            c2 = (pb[0] - k * db[0], pb[1] - k * db[1])
            out.append(f'C{pt(c1)} {pt(c2)} {pt(pb)}')
        return ' '.join(out)

    def path(self) -> str:
        return f'M{pt(self.punto(0))} {self.arco(0, 2 * math.pi)} Z'

    def local(self, p: Punto) -> Punto:
        """Coordenadas del círculo unidad de la elipse."""
        dx, dy = p[0] - self.c[0], p[1] - self.c[1]
        cg, sg = math.cos(self.giro), math.sin(self.giro)
        return ((dx * cg + dy * sg) / self.rx, (-dx * sg + dy * cg) / self.ry)


def forma(d: str, color: str, extra: str = '') -> str:
    return f'<path d="{d}" fill="{color}"{extra}/>'


def circulo(c: Punto, r: float, color: str) -> str:
    return f'<circle cx="{f(c[0])}" cy="{f(c[1])}" r="{f(r)}" fill="{color}"/>'


def lente(a: tuple[Punto, float], b: tuple[Punto, float]) -> str:
    """Intersección de dos círculos (c, r): el lado iluminado del planeta."""
    (ca, ra), (cb, rb) = a, b
    dx, dy = cb[0] - ca[0], cb[1] - ca[1]
    d = math.hypot(dx, dy)
    x = (d * d + ra * ra - rb * rb) / (2 * d)
    h = math.sqrt(ra * ra - x * x)
    base = math.atan2(dy, dx)
    da = math.acos(x / ra)                      # medio ángulo del arco de A dentro de B
    db = math.acos((d - x) / rb)                # medio ángulo del arco de B dentro de A
    ea, eb = Elipse(ca, ra, ra), Elipse(cb, rb, rb)
    # arco de A alrededor de la dirección hacia B; arco de B alrededor de la dirección hacia A
    p0 = ea.punto(base - da)
    return f'M{pt(p0)} {ea.arco(base - da, base + da)} {eb.arco(base + math.pi - db, base + math.pi + db)} Z'


def banda_en_elipse(e: Elipse, angulo: float, u0: float, u1: float) -> str:
    """Franja de la elipse entre dos rectas paralelas.

    En el círculo unidad de la elipse, la franja es u0 <= x·cos(angulo) + y·sin(angulo) <= u1
    (|u| < 1). Devuelve el trazado: cuerda u0, arco, cuerda u1, arco.
    """
    a = math.radians(angulo)
    w0, w1 = math.acos(u0), math.acos(u1)      # semiancho angular de cada cuerda
    # puntos de la cuerda u: ángulos a ± acos(u)
    t0a, t0b = a + w0, a - w0
    t1a, t1b = a + w1, a - w1
    return (f'M{pt(e.punto(t0b))} {e.arco(t0b, t1b)} L{pt(e.punto(t1a))} '
            f'{e.arco(t1a, t0a)} Z')


def moneda(c: Punto, escala: float, m: dict) -> str:
    """Moneda vista de lado: canto (extrusión), cara, brillos y aro grabado."""
    rx, ry, giro = m['rx'] * escala, m['ry'] * escala, m['giro']
    # el canto se extruye a lo largo del eje corto, hacia +y local
    g = math.radians(giro)
    ny = (-math.sin(g), math.cos(g))
    off = m['canto'] * escala
    cara = Elipse(c, rx, ry, giro)
    abajo = Elipse((c[0] + ny[0] * off, c[1] + ny[1] * off), rx, ry, giro)
    canto = (f'M{pt(cara.punto(0))} {cara.arco(0, -math.pi)} L{pt(abajo.punto(math.pi))} '
             f'{abajo.arco(math.pi, 0)} Z')
    borde = f' stroke="{m["color_canto"]}" stroke-width="{f(m["contorno"] * escala)}" stroke-linejoin="round"'
    partes = [forma(canto, m['color_canto'], borde), forma(cara.path(), m['color_cara'])]
    for u0, u1 in m['brillos']:
        partes.append(forma(banda_en_elipse(cara, m['angulo_brillo'], u0, u1), m['color_brillo']))
    s = m['aro_corrimiento'] * escala
    aro = Elipse((c[0] - ny[0] * s, c[1] - ny[1] * s), rx * m['aro'], ry * m['aro'], giro)
    partes.append(f'<path d="{aro.path()}" fill="none" stroke="{m["color_aro"]}" '
                  f'stroke-width="{f(m["aro_ancho"] * escala)}" stroke-linecap="round"/>')
    return ''.join(partes)


# ---------- Polígonos densos (para recortes sin clip-path) ----------

def muestrear(e: Elipse, n: int = 720) -> list[Punto]:
    return [e.punto(2 * math.pi * k / n) for k in range(n)]


def recortar(pts: list[Punto], dentro) -> list[Punto]:
    """Sutherland–Hodgman contra una región convexa dada por `dentro(p) -> distancia con signo` (≤ 0 dentro)."""
    out: list[Punto] = []
    n = len(pts)
    for k in range(n):
        a, b = pts[k - 1], pts[k]
        da, db = dentro(a), dentro(b)
        if db <= 0:
            if da > 0:
                s = da / (da - db)
                out.append((a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s))
            out.append(b)
        elif da <= 0:
            s = da / (da - db)
            out.append((a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s))
    return out


def en_circulo(c: Punto, r: float):
    return lambda p: math.hypot(p[0] - c[0], p[1] - c[1]) - r


def en_semiplano(p0: Punto, normal: Punto):
    """Lado de atrás: (p - p0)·normal ≤ 0."""
    return lambda p: (p[0] - p0[0]) * normal[0] + (p[1] - p0[1]) * normal[1]


def poligono(pts: list[Punto]) -> str:
    if len(pts) < 3:
        return ''
    return 'M' + pt(pts[0]) + ' ' + ' '.join('L' + pt(p) for p in pts[1:]) + ' Z'


def recortar_poligono(pts: list[Punto], clip: list[Punto]) -> list[Punto]:
    """Recorta `pts` con un polígono convexo `clip` (antihorario o horario), lado por lado."""
    area = sum(clip[k - 1][0] * clip[k][1] - clip[k][0] * clip[k - 1][1] for k in range(len(clip)))
    signo = 1 if area > 0 else -1
    out = pts
    for k in range(len(clip)):
        a, b = clip[k - 1], clip[k]
        nx, ny = (b[1] - a[1]) * signo, -(b[0] - a[0]) * signo   # normal hacia afuera
        out = recortar(out, lambda p, a=a, nx=nx, ny=ny: (p[0] - a[0]) * nx + (p[1] - a[1]) * ny)
        if not out:
            break
    return out


def silueta(pts, n: int = 48, sigma: float = 1.5) -> str:
    """Contorno cerrado (de una referencia raster) → silueta suave: remuestreo parejo, suavizado gaussiano y
    curva Catmull-Rom pasada a cúbicas. Pocos nodos, sin motas ni dientes."""
    import numpy as np
    p = np.asarray(pts, float)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(np.r_[p, p[:1]], axis=0).T))]
    s = np.linspace(0, seg[-1], n, endpoint=False)
    q = np.c_[np.interp(s, seg, np.r_[p[:, 0], p[0, 0]]), np.interp(s, seg, np.r_[p[:, 1], p[0, 1]])]
    if sigma > 0:
        k = np.arange(-3 * int(np.ceil(sigma)), 3 * int(np.ceil(sigma)) + 1)
        w = np.exp(-k ** 2 / (2 * sigma ** 2))
        w /= w.sum()
        q = sum(wi * np.roll(q, -ki, axis=0) for ki, wi in zip(k, w))
    out = [f'M{pt(tuple(q[0]))}']
    for i in range(n):
        p0, p1, p2, p3 = q[i - 1], q[i], q[(i + 1) % n], q[(i + 2) % n]
        c1, c2 = p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6
        out.append(f'C{pt(tuple(c1))} {pt(tuple(c2))} {pt(tuple(p2))}')
    return ' '.join(out) + ' Z'
