"""Aligera un SVG de personaje para animación: cada trazado se muestrea, se reduce con Ramer-Douglas-Peucker
(tolerancia en px) y se vuelve a ajustar con curvas Catmull-Rom. Mantiene colores, orden y grupos.

Uso: ~/.venvs/mascot/bin/python aligerar_svg.py <entrada.svg> <salida.svg> [tolerancia=0.7]
"""
import re
import sys

import numpy as np


def bezier(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n, endpoint=False)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def subtrazados(d):
    tok = re.findall(r'[MLCQZmlcqz]|-?\d*\.?\d+(?:e-?\d+)?', d)
    subs, cur, k, cmd, last = [], None, 0, None, None
    def pt():
        nonlocal k
        v = np.array([float(tok[k]), float(tok[k + 1])]); k += 2; return v
    while k < len(tok):
        if re.match(r'[A-Za-z]', tok[k]):
            cmd = tok[k].upper(); k += 1
            if cmd == 'Z':
                if cur is not None: subs.append(cur)
                cur = None; continue
        if cmd == 'M':
            if cur is not None: subs.append(cur)
            last = pt(); cur = [last[None, :]]; cmd = 'L'
        elif cmd == 'L':
            p = pt(); cur.append(np.linspace(last, p, max(2, int(np.hypot(*(p - last)))), endpoint=False)[1:] if np.hypot(*(p-last))>1 else p[None,:]); last = p
        elif cmd == 'C':
            c1, c2, p = pt(), pt(), pt()
            n = max(2, int(np.hypot(*(p - last)) + np.hypot(*(c1 - last)) + np.hypot(*(c2 - p))) // 1)
            cur.append(bezier(last, c1, c2, p, n)[1:]); cur.append(p[None, :]); last = p
        elif cmd == 'Q':
            q, p = pt(), pt(); c1 = last + 2 / 3 * (q - last); c2 = p + 2 / 3 * (q - p)
            cur.append(bezier(last, c1, c2, p, 8)[1:]); cur.append(p[None, :]); last = p
    if cur is not None: subs.append(cur)
    return [np.vstack(s) for s in subs]


def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    ab = b - a; L = np.hypot(*ab)
    r = pts - a
    d = np.abs(ab[0] * r[:, 1] - ab[1] * r[:, 0]) / L if L > 1e-9 else np.hypot(r[:, 0], r[:, 1])
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])


def cerrado(pts, eps):
    # RDP sobre un lazo cerrado: se parte en el punto más lejano del primero.
    j = int(np.argmax(np.hypot(*(pts - pts[0]).T)))
    p = np.vstack([rdp(pts[:j + 1], eps)[:-1], rdp(np.vstack([pts[j:], pts[:1]]), eps)[:-1]])
    return p


def catmull(q):
    n = len(q)
    f = lambda v: f'{v[0]:.1f} {v[1]:.1f}'
    out = [f'M{f(q[0])}']
    for i in range(n):
        p0, p1, p2, p3 = q[i - 1], q[i], q[(i + 1) % n], q[(i + 2) % n]
        out.append(f'C{f(p1 + (p2 - p0) / 6)} {f(p2 - (p3 - p1) / 6)} {f(p2)}')
    return ''.join(out) + 'Z'


def aligerar(d, eps):
    partes = []
    for s in subtrazados(d):
        if len(s) < 3: continue
        # piezas chicas (ojos, brillos, mejillas) casi intactas: ahí 1 px se nota
        diag = float(np.hypot(*(s.max(0) - s.min(0))))
        q = cerrado(s, eps if diag > 24 else min(eps, 0.4))
        if len(q) >= 3: partes.append(catmull(q))
    return ' '.join(partes)


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    eps = float(sys.argv[3]) if len(sys.argv) > 3 else 0.7
    svg = open(src).read()
    svg = re.sub(r'(<path d=")([^"]+)(")', lambda m: m.group(1) + aligerar(m.group(2), eps) + m.group(3), svg)
    open(dst, 'w').write(svg)
