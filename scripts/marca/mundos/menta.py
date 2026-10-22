"""Planeta 3 · menta con un anillo liso y uno de monedas pequeñas, paralelos.

Referencia: `assets/brand/bocetos/mundos-05-menta.png` (Gemini, 1024 px). Medidas con `python -m mundos.medir`:
disco c=(512, 512) r=263; luz c=(423, 415) r=271; anillo de monedas a=450 b=196 a -39°; anillo liso a=380 b=155.
"""
from .naranja import MONEDA
from .planeta import construir

CFG = {
    'nombre': 'menta',
    'origen': (35.0, 22.0),
    'planeta': {
        'c': (511.6, 511.9), 'r': 262.7, 'color_sombra': '#70B691',
        'luz': {'c': (422.6, 414.6), 'r': 270.8}, 'color_luz': '#9CE5BC',
        'brillos': [{'c': (390.8, 360.5), 'rx': 39.6, 'ry': 29.6, 'giro': 138.6},
                    {'c': (339.7, 414.7), 'rx': 12.0, 'ry': 12.0}],
        'color_brillo': '#B9F3D3',
    },
    'orbita': {'c': (515.2, 514.2), 'a': 449.6, 'b': 195.6, 'giro': -39.1, 'reparto': 0.9},
    'linea_orbita': {'c': (517.3, 513.5), 'a': 380.3, 'b': 154.9, 'ancho': 13, 'color': '#90D3AC'},
    # Monedas pequeñas casi de frente, en cadena.
    'satelites': {**MONEDA, 'rx': 21.0, 'ry': 19.5, 'giro': -40.0, 'canto': 5.0, 'contorno': 3.5,
                  'brillos': [(-0.3, 0.08)], 'angulo_brillo': 90.0, 'aro': 0.66, 'aro_ancho': 2.4,
                  'aro_corrimiento': 1.0, 'n': 76, 'fase': 0.0, 'escala_atras': 0.85, 'avance': 8 / 76,
                  'color_cara': '#FDC940', 'color_brillo': '#FFE07A', 'color_canto': '#C8901E', 'color_aro': '#C8901E'},
    'animacion': {'duracion': 6, 'bamboleo': 0},
}

if __name__ == '__main__':
    construir(CFG)
