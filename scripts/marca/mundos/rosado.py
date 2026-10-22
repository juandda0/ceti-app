"""Planeta 7 · rosado con un racimo de cristales redondeados.

Referencia: `assets/brand/bocetos/mundos-09-rosado.png` (Gemini, 1024 px). Disco c=(512, 511) r=320; luz
c=(447, 447) r=313. Cráter y cristales (dos dorados, dos lilas) salen de la referencia (`rosado-cristales.json`)
como siluetas suaves: cuerpo en el tono oscuro, cara clara, tapa redonda y su brillo.
"""
import json
from pathlib import Path

from .geometria import Elipse, forma, silueta
from .planeta import construir

ORIGEN = (32.0, 40.0)
C = json.loads((Path(__file__).parent / 'rosado-cristales.json').read_text())
COLOR = {
    'crater': '#DF7889',
    'lila': {'todo': '#A872C0', 'claro': '#C590DF', 'tapa': '#E1B0ED', 'brillo': '#F6D9F5'},
    'oro': {'todo': '#D59A1C', 'claro': '#EDB430', 'tapa': '#FCCE56', 'brillo': '#FFF2C4'},
}
# Cristales como prismas con tapa redonda, medidos en la referencia (px de 1024): centro de la tapa, centro de
# la base, medio ancho y alto de la tapa. En orden de pintado: los de atrás primero.
CRISTALES = [
    ('lila', (790.0, 216.0), (712.0, 312.0), 45.0, 30.0),
    ('lila', (823.0, 334.0), (730.0, 402.0), 37.0, 26.0),
    ('oro', (667.0, 200.0), (660.0, 328.0), 50.0, 33.0),
    ('oro', (732.0, 324.0), (668.0, 388.0), 40.0, 28.0),
]
PIVOTE = (690.0, 335.0)  # base del racimo, en el cráter


def prisma(fam, tapa, base, w, h) -> str:
    """Cuerpo (tono oscuro) con su cara clara del lado de la luz, tapa en elipse y un brillo."""
    import math
    tx, ty = tapa[0] - ORIGEN[0], tapa[1] - ORIGEN[1]
    bx, by = base[0] - ORIGEN[0], base[1] - ORIGEN[1]
    largo = math.hypot(tx - bx, ty - by)
    ux, uy = (tx - bx) / largo, (ty - by) / largo          # eje, de la base a la tapa
    nx, ny = -uy, ux                                        # normal
    giro = math.degrees(math.atan2(ny, nx))
    col = COLOR[fam]
    r = min(12.0, w * 0.3)                                  # esquinas redondeadas de la base

    def p(a, b):
        return f'{a:.2f} {b:.2f}'

    def lado(s0, s1):
        # banda del cuerpo entre las rectas s0·w y s1·w a lo ancho (s en [-1, 1]), base redondeada
        q = lambda s, t: (bx + nx * s * w + ux * t, by + ny * s * w + uy * t)
        a0, a1 = q(s0, largo), q(s1, largo)
        b0, b1 = q(s0, r if s0 == -1 else 0), q(s1, r if s1 == 1 else 0)
        c0, c1 = q(s0 * (1 - r / w) if s0 == -1 else s0, 0), q(s1 * (1 - r / w) if s1 == 1 else s1, 0)
        d = f'M{p(*a0)} L{p(*b0)}'
        d += f' Q{p(*q(s0, 0))} {p(*c0)}' if s0 == -1 else ''
        d += f' L{p(*c1)}'
        d += f' Q{p(*q(s1, 0))} {p(*b1)}' if s1 == 1 else f' L{p(*b1)}'
        return d + f' L{p(*a1)} Z'

    tapa_e = Elipse((tx, ty), w, h, giro)
    # cúpula: media elipse más allá de la tapa, del mismo tono, para que la punta quede redonda
    cup = Elipse((tx, ty), w, h * 1.55, giro)
    cupula = f'M{p(*cup.punto(0))} {cup.arco(0, -math.pi)} Z'
    return (forma(lado(-1, 1), col['todo']) + forma(lado(-1, -0.05), col['claro'])
            + forma(cupula, col['tapa']) + forma(tapa_e.path(), col['tapa'])
            + forma(Elipse((tx - nx * w * 0.3 + ux * h * 0.55, ty - ny * w * 0.3 + uy * h * 0.55),
                           w * 0.28, h * 0.32, giro).path(), col['brillo']))


def cristales(_pl) -> str:
    def mover(c):
        return [(x - ORIGEN[0], y - ORIGEN[1]) for x, y in c]

    out = [forma(silueta(mover(c), max(28, len(c) // 6), 1.0), COLOR['crater']) for c in C['crater']]
    out += [prisma(*c) for c in CRISTALES]
    return ''.join(out)


CFG = {
    'nombre': 'rosado',
    'origen': ORIGEN,
    'planeta': {
        'c': (511.7, 511.2), 'r': 319.9, 'color_sombra': '#DF7889',
        'luz': {'c': (446.6, 446.6), 'r': 313.2}, 'color_luz': '#FFA7B5',
        'brillos': [{'c': (367.2, 319.1), 'rx': 34.0, 'ry': 48.1, 'giro': 52.0},
                    {'c': (305.8, 395.2), 'rx': 15.2, 'ry': 15.2}],
        'color_brillo': '#FCCAD0',
    },
    'extras': cristales,
    # El racimo se mece desde su base, como una planta.
    'anima_extras': {'mecer': 5, 'pivote': (PIVOTE[0] - ORIGEN[0], PIVOTE[1] - ORIGEN[1])},
    'animacion': {'duracion': 6},
}

if __name__ == '__main__':
    construir(CFG)
