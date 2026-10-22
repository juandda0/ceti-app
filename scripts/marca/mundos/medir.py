"""Medidas de un planeta en su referencia de Gemini: colores, disco, lado iluminado, brillos y elementos dorados.

Uso (desde scripts/marca): ~/.venvs/mascot/bin/python -m mundos.medir <imagen> [--k 7]
Imprime la paleta (k-means en Lab) y, para el color de planeta indicado, el círculo del disco y el de la luz.
"""
from __future__ import annotations

import argparse

import cv2
import numpy as np


def hexc(bgr) -> str:
    b, g, r = [int(v) for v in bgr]
    return f'#{r:02X}{g:02X}{b:02X}'


def circulo_ls(p: np.ndarray):
    A = np.c_[2 * p, np.ones(len(p))]
    b = (p ** 2).sum(1)
    x, y, k = np.linalg.lstsq(A, b, rcond=None)[0]
    return x, y, float(np.sqrt(k + x * x + y * y))


def ransac(p: np.ndarray, it=3000, tol=2.5, seed=0):
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(it):
        q = p[rng.choice(len(p), 3, replace=False)]
        try:
            x, y, r = circulo_ls(q)
        except np.linalg.LinAlgError:
            continue
        n = (np.abs(np.hypot(p[:, 0] - x, p[:, 1] - y) - r) < tol).sum()
        if best is None or n > best[0]:
            best = (n, x, y, r)
    _, x, y, r = best
    inl = p[np.abs(np.hypot(p[:, 0] - x, p[:, 1] - y) - r) < tol]
    return circulo_ls(inl), len(inl), len(p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('imagen')
    ap.add_argument('--k', type=int, default=7)
    ap.add_argument('--luz', help='índices de clase del lado iluminado, separados por coma')
    ap.add_argument('--sombra', help='índices de clase de la sombra del planeta')
    ap.add_argument('--brillo', help='índices de clase de los brillos')
    ap.add_argument('--oro', help='índices de clase dorados (para el ajuste de la órbita)')
    ap.add_argument('--mapa', help='guardar imagen de clases aquí')
    a = ap.parse_args()
    im = cv2.imread(a.imagen)
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    cv2.setRNGSeed(0)
    _, lbl, cen = cv2.kmeans(lab, a.k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.2), 4,
                             cv2.KMEANS_PP_CENTERS)
    lbl = lbl.reshape(im.shape[:2])
    for i in range(a.k):
        m = lbl == i
        print(i, hexc(np.median(im[m], 0)), int(m.sum()))
    if a.mapa:
        pal = np.array([np.median(im[lbl == i], 0) for i in range(a.k)], np.uint8)
        cv2.imwrite(a.mapa, pal[lbl])
    sel = lambda s: np.isin(lbl, [int(x) for x in s.split(',')]) if s else None
    luz, sombra, brillo, oro = sel(a.luz), sel(a.sombra), sel(a.brillo), sel(a.oro)
    if luz is not None and sombra is not None:
        cuerpo = (luz | sombra | (brillo if brillo is not None else False)).astype(np.uint8)
        cuerpo = cv2.morphologyEx(cuerpo, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        cs, _ = cv2.findContours(cuerpo, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(cs, key=cv2.contourArea).reshape(-1, 2).astype(float)
        print('disco', ransac(c[::2]))
        ls = cv2.morphologyEx(luz.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
        borde = cv2.morphologyEx(ls, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
        cerca_sombra = cv2.dilate(sombra.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
        p = np.argwhere(borde & cerca_sombra)[:, ::-1].astype(float)
        print('luz', ransac(p))
    if brillo is not None:
        n, et, st, cen2 = cv2.connectedComponentsWithStats(brillo.astype(np.uint8))
        for i in range(1, n):
            if st[i, 4] > 40:
                cs, _ = cv2.findContours((et == i).astype(np.uint8), 0, 1)
                print('brillo', st[i].tolist(), cv2.fitEllipse(cs[0]) if len(cs[0]) >= 5 else None)
    if oro is not None:
        p = np.argwhere(oro)[:, ::-1].astype(np.float32)
        print('oro elipse', cv2.fitEllipse(p[::3]), 'px', len(p))


if __name__ == '__main__':
    main()
