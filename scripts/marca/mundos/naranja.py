"""Planeta 1 · naranja con anillo de monedas.

Referencia: `assets/brand/bocetos/mundos-03-naranja.png` (Gemini, 1024 px). Medidas en px de la referencia:
planeta c=(503, 498) r=301; lado iluminado = intersección con el círculo c=(425, 425) r=303; órbita ajustada a los
centros de las monedas.

Uso (desde scripts/marca):  ~/.venvs/mascot/bin/python -m mundos.naranja
"""
from .planeta import construir

MONEDA = {
    'tipo': 'moneda',
    'rx': 72.0, 'ry': 46.0, 'giro': -38.0,          # cara: eje largo inclinado como en la referencia
    'canto': 13.0, 'contorno': 9.0,                 # grosor y contorno de la moneda (px a escala 1)
    'brillos': [(-0.40, 0.02), (0.14, 0.24)],       # franjas claras, en el círculo unidad de la cara
    'angulo_brillo': 58.0,
    'aro': 0.76, 'aro_ancho': 5.0, 'aro_corrimiento': 2.5,
    'color_cara': '#F2B542', 'color_brillo': '#F9CF66', 'color_canto': '#B97F25', 'color_aro': '#B97F25',
}

CFG = {
    'nombre': 'naranja',
    'origen': (20.0, 17.0),
    'planeta': {
        'c': (503.0, 498.0), 'r': 301.0, 'color_sombra': '#D5581E',
        'luz': {'c': (424.6, 425.4), 'r': 302.7}, 'color_luz': '#F4862F',
        'brillos': [{'c': (371.6, 301.2), 'rx': 42.7, 'ry': 29.1, 'giro': 145.4},
                    {'c': (309.5, 365.6), 'rx': 13.5, 'ry': 13.5}],
        'color_brillo': '#F7B05B',
    },
    'orbita': {'c': (497.4, 480.0), 'a': 436.3, 'b': 124.5, 'giro': -26.3, 'reparto': 0.6},
    'satelites': {**MONEDA, 'n': 24, 'fase': 0.0, 'escala_atras': 0.82, 'avance': 4 / 24},
    'animacion': {'duracion': 6},
}

if __name__ == '__main__':
    construir(CFG)
