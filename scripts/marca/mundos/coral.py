"""Planeta 8 · coral con un desfile de monedas en órbita.

Referencia: `assets/brand/bocetos/mundos-10-coral.png` (Gemini, 1024 px). Disco c=(511, 512) r=371; luz
c=(397, 396) r=376. Órbita ajustada a los centros de las 5 monedas; su tamaño sigue una onda a lo largo de la
órbita (r = 77 + 44·sen(t − 70°) px), por eso las monedas crecen al acercarse y se achican al irse.
"""
from .naranja import MONEDA
from .planeta import construir

CFG = {
    'nombre': 'coral',
    'origen': (42.0, 38.0),
    'planeta': {
        'c': (511.5, 511.5), 'r': 370.7, 'color_sombra': '#D84A36',
        'luz': {'c': (397.1, 396.3), 'r': 375.6}, 'color_luz': '#FB664E',
        'brillos': [{'c': (341.6, 293.7), 'rx': 41.1, 'ry': 59.1, 'giro': 48.7}],
        'color_brillo': '#FD8F78',
    },
    'orbita': {'c': (517.65, 496.22), 'a': 426.4, 'b': 205.1, 'giro': -31.3, 'reparto': 0.0},
    # Monedas de frente, con el canto a la derecha, como en la referencia.
    'satelites': {**MONEDA, 'rx': 108.0, 'ry': 108.0, 'giro': -81.0, 'canto': 12.0, 'contorno': 7.0,
                  'brillos': [(-0.45, -0.12), (0.05, 0.17)], 'angulo_brillo': 116.0, 'aro': 0.8,
                  'aro_ancho': 6.0, 'aro_corrimiento': 2.0,
                  'color_cara': '#F6BA33', 'color_brillo': '#FACD59', 'color_canto': '#AA670C',
                  'color_aro': '#CB8619',
                  'n': 6, 'fase': 0.0, 'escala_atras': 1.0, 'avance': 0.0},
    # Desfile: 6 monedas separadas 36° de órbita; la 0 nace en t0 = −29° (detrás del borde, arriba a la derecha) y
    # la 5 sale en 187° (abajo a la izquierda). Radio por la onda medida: 77 + 44·sen(t − 70°), máximo 120 px.
    'desfile': {'t0': -29.0, 'paso': 36.0, 'n': 6, 'r_media': 76.8, 'r_onda': 43.7, 'fase_r': 70.0, 'r_max': 120.4},
    'animacion': {'duracion': 3},
}

if __name__ == '__main__':
    construir(CFG)
