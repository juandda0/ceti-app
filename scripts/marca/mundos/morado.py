"""Planeta 4 · morado con pepitas de oro incrustadas.

Referencia: `assets/brand/bocetos/mundos-06-morado.png` (Gemini, 1024 px). Disco c=(511, 511) r=344; luz
c=(457, 448) r=340. Las 7 pepitas son formas orgánicas: su contorno sale de la referencia
(`morado-pepitas.json`, oscuro = pepita entera, claro = cara iluminada) y se redibuja como silueta suave.
"""
import json
from pathlib import Path

from .geometria import Elipse, forma, silueta
from .planeta import construir

ORIGEN = (31.0, 31.0)
PEPITAS = json.loads((Path(__file__).parent / 'morado-pepitas.json').read_text())
ORO = {'oscuro': '#AE8027', 'claro': '#E3AD33', 'brillo': '#F8D77E'}


def pepitas(_pl) -> str:
    def mover(c):
        return [(x - ORIGEN[0], y - ORIGEN[1]) for x, y in c]

    out = []
    for p in PEPITAS:
        n = max(28, min(64, len(p['oscuro']) // 6))
        out.append(forma(silueta(mover(p['oscuro']), n, 1.5), ORO['oscuro']))
        if p['claro']:
            out.append(forma(silueta(mover(p['claro']), n, 1.5), ORO['claro']))
        for x, y, rx, ry in p['brillos']:
            out.append(forma(Elipse((x - ORIGEN[0], y - ORIGEN[1]), max(rx, 5), max(ry, 4), -35).path(), ORO['brillo']))
    return ''.join(out)


CFG = {
    'nombre': 'morado',
    'origen': ORIGEN,
    'planeta': {
        'c': (511.5, 511.5), 'r': 343.9, 'color_sombra': '#814299',
        'luz': {'c': (457.0, 448.1), 'r': 340.1}, 'color_luz': '#AF6CD2',
        'brillos': [{'c': (333.7, 301.5), 'rx': 44.9, 'ry': 28.6, 'giro': 139.0},
                    {'c': (277.6, 372.0), 'rx': 17.0, 'ry': 14.0, 'giro': 121.0}],
        'color_brillo': '#D6B5EA',
    },
    'extras': pepitas,
    # Las pepitas se mecen sobre el planeta (como si girara un poco) mientras flota.
    'anima_extras': {'mecer': 6},
    'animacion': {'duracion': 6},
}

if __name__ == '__main__':
    construir(CFG)
