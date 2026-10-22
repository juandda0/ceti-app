"""Planeta 2 · lila con una luna que es una moneda.

Referencia: `assets/brand/bocetos/mundos-04-lila.png` (Gemini, 1024 px). Medidas con `python -m mundos.medir`:
disco c=(511, 512) r=370; luz c=(415, 418) r=354; órbita ajustada a la línea dorada.
"""
from .naranja import MONEDA
from .planeta import construir

CFG = {
    'nombre': 'lila',
    'origen': (32.0, 31.0),
    'planeta': {
        'c': (511.4, 511.5), 'r': 369.8, 'color_sombra': '#A07FC7',
        'luz': {'c': (415.4, 417.8), 'r': 353.7}, 'color_luz': '#BB99E5',
        'brillos': [{'c': (314.5, 278.5), 'rx': 50.0, 'ry': 28.2, 'giro': 138.6}],
        'color_brillo': '#D7C1EF',
    },
    'orbita': {'c': (509.9, 506.5), 'a': 467.6, 'b': 163.3, 'giro': -34.5, 'reparto': 0.6},
    'linea_orbita': {'ancho': 10, 'color': '#DDA330'},
    # La luna: una moneda casi de frente, con el canto hacia abajo a la derecha.
    'satelites': {**MONEDA, 'rx': 70.0, 'ry': 67.0, 'giro': -70.0, 'canto': 13.0, 'contorno': 8.0,
                  'brillos': [(-0.35, 0.05), (0.2, 0.32)], 'angulo_brillo': 90.0, 'aro': 0.72,
                  'n': 1, 'fase': 0.181, 'escala_atras': 0.75, 'avance': 1.0},
    'animacion': {'duracion': 6, 'inclinar': 1.2},
}

if __name__ == '__main__':
    construir(CFG)
