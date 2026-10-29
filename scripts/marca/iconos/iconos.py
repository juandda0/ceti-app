"""Íconos de los niveles del mapa: calcados de la hoja de Gemini `assets/brand/bocetos/iconos-01-hoja.png`
(10 íconos blancos, gorditos y tiernos, en una cuadrícula de 5 × 2 sobre naranja).

Cada ícono se recorta de su celda, se suaviza al cuádruple de tamaño y se calca como contornos con sus
huecos (regla par-impar), centrado en una caja de 100 × 100. Sale el módulo de la app con un trazado por
ícono.

Uso, desde scripts/marca/:
    ~/.venvs/mascot/bin/python -m iconos.iconos
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parents[3]
HOJA = RAIZ / 'assets/brand/bocetos/iconos-01-hoja.png'
SALIDA = RAIZ / 'src/features/learning/components/galaxia/iconosNodo.ts'

NOMBRES = [
    'astronauta', 'cohete', 'ovni', 'satelite', 'planeta',
    'luna', 'estrella', 'cometa', 'telescopio', 'alien',
]
COLUMNAS, FILAS = 5, 2
CAJA = 100
MARGEN = 4
ESCALA = 4


def f(v: float) -> str:
    s = f'{v:.1f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


def mascara(rgb: np.ndarray) -> np.ndarray:
    """Lo blanco del ícono contra el naranja del fondo."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    return ((hsv[..., 1] < 70) & (hsv[..., 2] > 200)).astype(np.uint8) * 255


def calcar(celda: np.ndarray) -> str:
    m = mascara(celda)
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    m = m[y0:y1, x0:x1]
    h, w = m.shape
    grande = cv2.resize(m, (w * ESCALA, h * ESCALA), interpolation=cv2.INTER_CUBIC)
    grande = cv2.GaussianBlur(grande, (0, 0), ESCALA * 0.9)
    _, grande = cv2.threshold(grande, 127, 255, cv2.THRESH_BINARY)
    contornos, _ = cv2.findContours(grande, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    lado = max(w, h) * ESCALA
    k = (CAJA - 2 * MARGEN) / lado
    dx = (CAJA - w * ESCALA * k) / 2
    dy = (CAJA - h * ESCALA * k) / 2
    partes = []
    for c in contornos:
        if cv2.contourArea(c) < (ESCALA * 2) ** 2:
            continue
        c = cv2.approxPolyDP(c, ESCALA * 0.35, True)[:, 0, :]
        pts = [f'{f(x * k + dx)} {f(y * k + dy)}' for x, y in c]
        partes.append('M' + ' L'.join(pts) + ' Z')
    return ' '.join(partes)


def main() -> None:
    hoja = cv2.cvtColor(cv2.imread(str(HOJA)), cv2.COLOR_BGR2RGB)
    alto, ancho = hoja.shape[:2]
    cw, ch = ancho / COLUMNAS, alto / FILAS
    lineas = [
        '/**',
        ' * Íconos de los niveles del mapa, calcados de assets/brand/bocetos/iconos-01-hoja.png.',
        ' * GENERADO por scripts/marca/iconos/iconos.py: no se edita a mano. Caja de 100 × 100,',
        ' * blancos y con regla par-impar (los huecos son contornos dentro de otros).',
        ' */',
        'export const ICONOS_NODO = {',
    ]
    for i, nombre in enumerate(NOMBRES):
        col, fila = i % COLUMNAS, i // COLUMNAS
        celda = hoja[int(fila * ch):int((fila + 1) * ch), int(col * cw):int((col + 1) * cw)]
        lineas.append(f"  {nombre}: '{calcar(celda)}',")
    lineas += ['} as const;', '', 'export type IconoNodo = keyof typeof ICONOS_NODO;', '']
    SALIDA.write_text('\n'.join(lineas))
    print('ok', SALIDA)


if __name__ == '__main__':
    main()
