"""Planeta 5 · azul con un anillo ancho de oro y gemas.

Referencia: `assets/brand/bocetos/mundos-07-azul.png` (Gemini, 1024 px). Disco c=(512, 511) r=262; luz
c=(452, 466) r=258; anillo: borde exterior a=464 b=148, interior a=326 b=87, a -28°, canto de 13 px.
"""
from .planeta import construir

CFG = {
    'nombre': 'azul',
    'origen': (29.0, 39.0),
    'planeta': {
        'c': (511.5, 511.2), 'r': 262.1, 'color_sombra': '#2A72B1',
        'luz': {'c': (451.6, 465.8), 'r': 258.0}, 'color_luz': '#4195DD',
        'brillos': [{'c': (376.0, 373.0), 'rx': 39.5, 'ry': 31.4, 'giro': 138.3}],
        'color_brillo': '#C1DBF5',
    },
    # Órbita de las gemas: la línea media del anillo.
    'orbita': {'c': (508.7, 514.0), 'a': 395.0, 'b': 117.5, 'giro': -28.4, 'reparto': 0.7},
    'banda': {'exterior': {'c': (508.7, 518.0), 'a': 464.0, 'b': 148.0},
              'interior': {'c': (508.8, 510.6), 'a': 325.7, 'b': 86.9},
              'canto': 13, 'color': '#EBB946', 'color_canto': '#C68A17'},
    'satelites': {'tipo': 'gema', 'ancho': 66, 'alto': 40, 'base': 17,
                  'colores': [('#D4579A', '#F77FB2', '#FFD3E6'), ('#24978D', '#38B9AF', '#C9F2EC'),
                              ('#6E48B4', '#926AD6', '#E2D5F7')],
                  'n': 9, 'fase': 0.02, 'escala_atras': 0.8,
                  # tres colores: para que el loop empalme, cada gema avanza tres puestos (hasta una del mismo color)
                  'avance': 3 / 9},
    'animacion': {'duracion': 6},
}

if __name__ == '__main__':
    construir(CFG)
