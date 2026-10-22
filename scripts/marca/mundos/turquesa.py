"""Planeta 6 · turquesa con un casquete de oro derretido.

Referencia: `assets/brand/bocetos/mundos-08-turquesa.png` (Gemini, 1024 px). Disco c=(511, 510) r=363; luz
c=(441, 447) r=346. El oro, su cara clara, sus brillos y la sombra que deja sobre el planeta salen de la
referencia (`turquesa-oro.json`) y se redibujan como siluetas suaves; la sombra se recorta al disco.
"""
import json
from pathlib import Path

from .geometria import Elipse, forma, muestrear, poligono, recortar_poligono, silueta
from .planeta import construir

ORIGEN = (32.0, 30.0)
ORO = json.loads((Path(__file__).parent / 'turquesa-oro.json').read_text())
COLOR = {'sombra_oro': '#187374', 'oscuro': '#C77819', 'claro': '#E4A321', 'brillo': '#F3C76E'}


def oro(pl) -> str:
    def mover(c):
        return [(x - ORIGEN[0], y - ORIGEN[1]) for x, y in c]

    disco = muestrear(Elipse(pl['c'], pl['r'] - 1, pl['r'] - 1), 360)
    out = []
    for s in ORO['sombras']:
        # silueta suave y luego recortada al disco: la sombra del oro solo cae sobre el planeta
        import re
        d = silueta(mover(s), max(24, len(s) // 7), 1.2)
        pts = [(float(a), float(b)) for a, b in re.findall(r'(-?[\d.]+) (-?[\d.]+)', d)]
        out.append(forma(poligono(recortar_poligono(pts, disco)), COLOR['sombra_oro']))
    out.append(forma(silueta(mover(ORO['oro']), len(ORO['oro']) // 9, 1.2), COLOR['oscuro']))
    out.append(forma(silueta(mover(ORO['claro']), len(ORO['claro']) // 9, 1.2), COLOR['claro']))
    for x, y, rx, ry, g in ORO['brillos']:
        if min(rx, ry) >= 3:
            out.append(forma(Elipse((x - ORIGEN[0], y - ORIGEN[1]), rx, ry, g).path(), COLOR['brillo']))
    return ''.join(out)


CFG = {
    'nombre': 'turquesa',
    'origen': ORIGEN,
    'planeta': {
        'c': (511.4, 510.4), 'r': 362.6, 'color_sombra': '#187374',
        'luz': {'c': (441.3, 446.5), 'r': 345.9}, 'color_luz': '#289F9D',
        'brillos': [],
        'color_brillo': '#F3C76E',
    },
    'extras': oro,
    # El oro "chorrea": se estira hacia abajo desde la cima del planeta y vuelve.
    'anima_extras': {'estirar': 6},
    'animacion': {'duracion': 6},
}

if __name__ == '__main__':
    construir(CFG)
