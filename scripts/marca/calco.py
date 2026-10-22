"""Calco v2: convierte una ilustración plana (p. ej. una hoja de modelo de Gemini) en un SVG limpio por capas.

Pipeline:
  1. Recorte y reescalado (x ESCALA) + aplanado de color con mean-shift (bordes nítidos, sin ruido de JPEG).
  2. Clasificación de cada píxel a la paleta del personaje en espacio Lab + filtro de mayoría.
  3. Figura = todo lo que no se alcanza desde el borde por fondo/piso (las líneas la cierran).
  4. Líneas (si la referencia trae contorno) -> borde en un tono más oscuro del relleno vecino.
  5. Limpieza de islas pequeñas.
  6. Apilado: cada capa se extiende un poco por debajo de las que van encima (sin hendiduras entre colores).
  7. Trazado de cada capa con potrace (curvas Bézier óptimas con esquinas reales).
  8. Primitivas geométricas para ojos (círculos) y piso (elipse).
  9. Control de calidad: render del SVG vs. clasificación de la referencia (% de píxeles que coinciden).

Uso: ~/.venvs/mascot/bin/python scripts/marca/calco.py tato [--escala 2]
"""
import argparse
import json
import sys
import time

import cairosvg
import cv2
import numpy as np
import potrace
from PIL import Image
from scipy import ndimage as ndi

# ---------------------------------------------------------------- configuración por personaje
PERSONAJES = {
    'juan': {
        'src': 'assets/brand/bocetos/juan-02-capitan.jpg',
        'box': (120, 40, 580, 820),
        'out': 'assets/brand/juan/juan-frente-candidato.svg',
        'paleta': {
            'fondo': ('FCEFDB', None, 'fondo'),
            'piso': ('E8BD93', 'E8BD93', 'piso'),
            'linea': ('BB8A6B', None, 'linea'),
            'linea-cara': ('AD6454', None, 'linea'),
            'traje': ('FCE4C0', 'FCE4C0', 'relleno'),
            'guante': ('E4C39E', 'E4C39E', 'relleno'),
            'azul': ('78B9C1', '7EC8F0', 'relleno'),
            'azul-osc': ('568F90', '4E9CC2', 'relleno'),
            'piel': ('F7B597', 'F7B597', 'relleno'),
            'piel-osc': ('E59579', 'E59579', 'relleno'),
            'pelo': ('AF7045', 'AF7045', 'relleno'),
            'pelo-osc': ('8E4E33', '8E4E33', 'relleno'),
            'vinotinto': ('752E2C', '752E2C', 'relleno'),
            'naranja': ('EF7F2A', 'FB6711', 'relleno'),
            'blanco': ('FEFBF9', 'FFFFFF', 'relleno'),
            'pantalla': ('4E5D6B', '3E4C5A', 'relleno'),
            'marco': ('B3CCD5', 'C9DDE4', 'relleno'),
            'brillo': ('7CC0B7', '8FE3D2', 'relleno'),
            'oro': ('A3672C', 'C98A2E', 'relleno'),
            'rojo': ('BE282A', 'D23A33', 'relleno'),
            'traje-sombra': ('FF00FF', 'E9C9A6', 'relleno'),
        },
        'piso_interior': 'traje-sombra',
        'borde': {'traje-sombra': 'D2AB86', 'traje': 'E6C29A', 'guante': 'C9A27F', 'azul': '4E9CC2', 'azul-osc': '3B7FA3',
                  'piel': 'C26A58', 'piel-osc': 'B5604F', 'pelo': '8E4E33', 'pelo-osc': '7A4029', 'naranja': 'C9520D',
                  'blanco': 'B5655A', 'vinotinto': '752E2C', 'pantalla': '2E3A46', 'marco': '4E9CC2', 'brillo': '4E9CC2',
                  'oro': '8E5A1F', 'rojo': '9E1F22'},
        'orden': ['traje', 'traje-sombra', 'guante', 'azul-osc', 'azul', 'marco', 'pantalla', 'brillo', 'piel-osc', 'piel',
                  'naranja', 'oro', 'rojo', 'blanco', 'vinotinto', 'pelo-osc', 'pelo'],
        'ojos': {'zona': (130, 140, 190, 290), 'iris': 'vinotinto', 'blanco': 'blanco', 'aro': 'C9705C', 'piel': 'piel'},
        'pies': 'guante',
        'nariz': {'centro': (210, 183), 'radio': 15, 'color': 'E8907A', 'umbral': 3, 'borde': 'C9705C'},
        'corregir': [
            # nariz: la sombra se confunde con pelo; queda piel y la nariz se dibuja como forma limpia
            {'zona': [(190, 165), (232, 165), (232, 200), (190, 200)], 'de': ['pelo', 'pelo-osc', 'piel-osc', 'oro'], 'a': 'piel'},
            # boca: el borde oscuro se confunde con pelo
            {'zona': [(170, 200), (260, 200), (260, 240), (170, 240)], 'de': ['pelo', 'pelo-osc', 'oro'], 'a': 'linea-cara'},
            # reloj: el aro dorado se confunde con pelo
            {'zona': [(345, 455), (380, 455), (380, 490), (345, 490)], 'de': ['pelo', 'pelo-osc'], 'a': 'oro'},
        ],
        'partes': {
            'cabeza': {'poligono': [(70, 20), (360, 20), (360, 262), (70, 262)],
                       'excluir': ['traje', 'traje-sombra'], 'pivote': (213, 252), 'solapa': 6},
            'brazo-izq': {'poligono': [(96, 270), (133, 372), (128, 470), (124, 565), (25, 565), (25, 320)],
                          'pivote': (113, 302), 'solapa': 7},
            'brazo-der': {'poligono': [(330, 270), (294, 372), (296, 402), (232, 402), (228, 545), (410, 545), (410, 320)],
                          'pivote': (313, 302), 'solapa': 7,
                          'excluir_en': {'poligono': [(225, 395), (300, 395), (300, 550), (225, 550)], 'clases': ['traje']}},
        },
        'cara_en': 'cabeza',
        'espejo': {'parte': 'brazo-der', 'cx': 213, 'desde_y': 395},
        'lineas': 'trazo',
        'lineas_por_contraste': 5,
        'espiga': 10,
        'sin_lineas': [[(232, 123), (273, 123), (273, 147), (232, 147)],  # ceja: queda como forma rellena
                       # bajo las orejas y delante de ellas: lo dibuja la cara a mano
                       {'poligono': [(95, 196), (160, 196), (160, 264), (95, 264)], 'clases': ['pelo', 'pelo-osc', 'piel', 'piel-osc']},
                       {'poligono': [(265, 196), (330, 196), (330, 264), (265, 264)], 'clases': ['pelo', 'pelo-osc', 'piel', 'piel-osc']},
                       [(122, 168), (142, 168), (142, 205), (122, 205)], [(282, 168), (302, 168), (302, 205), (282, 205)]],
        'contraste_min': 14,
        'detalles': [
            {   # insignia: panel con la ballena de Ceti
                'parte': 'cuerpo',
                'svg': ('<g id="insignia">'
                        '<rect x="163" y="319" width="102" height="67" rx="10" fill="#4E9CC2"/>'
                        '<rect x="170" y="326" width="88" height="53" rx="6.5" fill="#7EC8F0"/>'
                        '<path d="M176 349 C175 339 186 331 200 331 C214 331 223 339 229 346 C231 348 233 348 234 346 '
                        'C231 342 227 337 229 334 C233 332 238 337 240 341 C244 339 250 339 253 343 C249 348 243 350 238 351 '
                        'C234 362 222 372 205 373 C190 374 177 362 176 349 Z" fill="#FB6711"/>'
                        '<path d="M178 357 C188 361 201 362 213 368 C217 371 215 375 207 375 C194 376 183 368 178 357 Z" fill="#FFE0B8"/>'
                        '<path d="M184 361 L203 372 M190 360 L208 370 M196 361 L211 368" stroke="#E58A6A" stroke-width="1" '
                        'stroke-linecap="round" fill="none"/>'
                        '<circle cx="181.5" cy="348.5" r="1.7" fill="#5A2E22"/><circle cx="193.5" cy="348" r="1.8" fill="#5A2E22"/>'
                        '</g>'),
                'zona': [(164, 320), (264, 320), (264, 385), (164, 385)],
                'lineas_todas': True,
                'vaciar': ['azul', 'azul-osc', 'naranja', 'blanco', 'piel', 'piel-osc', 'vinotinto', 'oro', 'marco', 'brillo', 'pelo', 'pelo-osc'],
                'debajo': False,
            },
            {   # tablet de mando (queda detrás de la mano y del brazo)
                'parte': 'brazo-der',
                'svg': ('<g id="tablet" transform="translate(314.5 465) rotate(-10)">'
                        '<rect x="-76" y="-58" width="152" height="116" rx="17" fill="#4E9CC2"/>'
                        '<rect x="-67" y="-49" width="134" height="98" rx="12" fill="#C9DDE4"/>'
                        '<rect x="-48" y="-41" width="109" height="82" rx="10" fill="#3E4C5A"/>'
                        '<rect x="-62" y="-9" width="6" height="18" rx="3" fill="#4E9CC2"/>'
                        '<rect x="-40" y="-31" width="30" height="6" rx="3" fill="#8FE3D2"/>'
                        '<rect x="-40" y="-21" width="22" height="6" rx="3" fill="#8FE3D2"/>'
                        '<rect x="-38" y="-8" width="14" height="26" rx="4" fill="#8FE3D2"/>'
                        '<rect x="-36" y="-6" width="10" height="8" rx="2" fill="#F7E36B"/>'
                        '<rect x="-14" y="26" width="26" height="6" rx="3" fill="#8FE3D2"/>'
                        '<path d="M14 -24 A24 24 0 0 1 14 22" stroke="#8FE3D2" stroke-width="4" fill="none" stroke-linecap="round"/>'
                        '</g>'),
                'zona': [(227, 419), (381, 391), (403, 511), (248, 539)],
                'vaciar': ['azul', 'azul-osc', 'marco', 'pantalla', 'brillo', 'oro', 'blanco', 'naranja', 'vinotinto', 'pelo',
                           'pelo-osc', 'piel', 'piel-osc', 'rojo'],
                'debajo': True,
            },
            {   # reloj (encima de la muñeca)
                'parte': 'brazo-der',
                'svg': ('<g id="reloj"><path d="M306 467 L352 463 L353 475 L307 479 Z" fill="#8B4A2B"/>'
                        '<circle cx="361" cy="471" r="9.8" fill="#C98A2E"/><circle cx="361" cy="471" r="5.8" fill="#FFF4E0"/></g>'),
                'debajo': False,
            },
            {   # cara completa a mano: pelo de atrás, orejas, cara, cuello (debajo del pelo calcado)
                'parte': 'cabeza',
                'svg': ('<g id="cara">'
                        # pelo de atrás, visible bajo las orejas
                        '<path d="M110 186 C104 212 116 238 146 250 L156 236 C142 222 136 204 136 188 Z" fill="#AF7045" stroke="#8E4E33" stroke-width="3.5" stroke-linejoin="round"/>'
                        '<path d="M314 186 C320 212 308 238 278 250 L268 236 C282 222 288 204 288 188 Z" fill="#AF7045" stroke="#8E4E33" stroke-width="3.5" stroke-linejoin="round"/>'
                        # cuello
                        '<path d="M182 238 L244 238 L245 259 C226 262 200 262 181 259 Z" fill="#E59579" stroke="#B5655A" stroke-width="4" stroke-linejoin="round"/>'
                        # orejas
                        '<ellipse cx="117" cy="177" rx="12" ry="22" fill="#F7B597" stroke="#B5655A" stroke-width="4"/>'
                        '<path d="M115 166 C108 174 110 188 118 194" stroke="#E59579" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
                        '<ellipse cx="307" cy="177" rx="12" ry="22" fill="#F7B597" stroke="#B5655A" stroke-width="4"/>'
                        '<path d="M309 166 C316 174 314 188 306 194" stroke="#E59579" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
                        # cara
                        '<path d="M136 150 C134 185 136 214 150 231 C165 247 190 252 212 252 C236 252 260 246 274 230 '
                        'C287 213 290 185 288 150 C287 100 250 70 212 70 C174 70 137 100 136 150 Z" fill="#F7B597"/>'
                        '<path d="M136 140 C134 185 136 214 150 231 C165 247 190 252 212 252 C236 252 260 246 274 230 '
                        'C287 213 290 185 288 140" fill="none" stroke="#B5655A" stroke-width="4.2" stroke-linecap="round"/>'
                        '</g>'),
                'zona': [(98, 138), (140, 98), (290, 98), (328, 138), (328, 208), (292, 238), (252, 266), (174, 266),
                         (134, 238), (98, 208)],
                'vaciar': ['piel', 'piel-osc', 'vinotinto', 'blanco', 'naranja', 'oro'],
                'debajo': True,
            },
            {   # textura calcada del pelo de atrás: la reemplazan los lóbulos limpios de la cara
                'parte': 'cabeza',
                'svg': '',
                'zona': [(98, 200), (162, 200), (162, 262), (98, 262)],
                'zona2': [(262, 200), (328, 200), (328, 262), (262, 262)],
                'vaciar': ['pelo', 'pelo-osc'],
                'debajo': True,
            },
            {   # rasgos encima del pelo calcado: rubor y boca
                'parte': 'cabeza',
                'svg': ('<g id="rasgos">'
                        '<ellipse cx="162" cy="190" rx="14" ry="6.5" fill="#EC917A"/>'
                        '<ellipse cx="262.5" cy="190" rx="14.5" ry="6.5" fill="#EC917A"/>'
                        '<path d="M180 206 Q212 200 245 205 C243 219 230 229 212 229 C194 229 182 219 180 206 Z" '
                        'fill="#FFFFFF" stroke="#B5655A" stroke-width="4.2" stroke-linejoin="round"/>'
                        '</g>'),
                'debajo': False,
            },
            {   # ceja visible (la otra queda bajo el flequillo)
                'parte': 'cabeza',
                'svg': '<path id="ceja" d="M241.5 132.5 Q251 125.5 261 131.5" stroke="#8E4E33" stroke-width="8.5" fill="none" stroke-linecap="round"/>',
                'zona': [(232, 123), (273, 123), (273, 147), (232, 147)],
                'vaciar': ['pelo-osc', 'vinotinto'],
                'lineas_todas': True,
                'rellenar': 'piel',
                'debajo': False,
            },
            {   # pulsera roja de hilo con nudo
                'parte': 'brazo-izq',
                'svg': ('<g id="pulsera" fill="none" stroke="#D23A33" stroke-linecap="round" stroke-linejoin="round">'
                        '<path d="M58 471 C72 468 94 468 112 471" stroke-width="5"/>'
                        '<path d="M70 469 C64 463 56 462 56 466 C56 469 62 470 70 469" stroke-width="3.6"/>'
                        '<path d="M69 472 C62 477 54 476 55 472" stroke-width="3.6"/></g>'),
                'zona': [(48, 458), (122, 458), (122, 482), (48, 482)],
                'vaciar': ['rojo', 'naranja', 'vinotinto', 'pelo-osc'],
                'debajo': False,
            },
        ],
        'base': 'E6C29A',
    },
    'tato': {
        'src': 'assets/brand/bocetos/tato-03-hoja-modelo.jpg',
        'box': (100, 30, 620, 820),
        'out': 'assets/brand/tato/tato-frente-candidato.svg',
        # clase: (color de referencia en la imagen, color final, rol)
        'paleta': {
            'fondo': ('FBEFDB', None, 'fondo'),
            'piso': ('E2BA93', 'E2BA93', 'piso'),
            'linea': ('BB8A6A', None, 'linea'),
            'traje': ('FDE6C2', 'FDE6C2', 'relleno'),
            'guante': ('E5C3A1', 'E5C3A1', 'relleno'),
            'turquesa': ('6DB2AB', '6DB2AB', 'relleno'),
            'turquesa-osc': ('408D8C', '408D8C', 'relleno'),
            'piel': ('B9724F', 'B9724F', 'relleno'),
            'piel-osc': ('94503D', '94503D', 'relleno'),
            'pelo': ('232121', '232121', 'relleno'),
            'vinotinto': ('742F36', '742F36', 'relleno'),
            'naranja': ('EE8329', 'EE8329', 'relleno'),
            'rubor': ('E68364', 'E68364', 'relleno'),
            'blanco': ('F7F1EE', 'FFFFFF', 'relleno'),
            # sombra del traje (interior del cuello): se parece al piso; se asigna por regla, no por color
            'traje-sombra': ('FF00FF', 'DDB894', 'relleno'),
        },
        # dentro de la figura y por encima de las botas, lo que parece "piso" es sombra del traje
        'piso_interior': 'traje-sombra',
        # borde (tono más oscuro) que reemplaza a la línea según el relleno vecino
        'borde': {'traje-sombra': 'C99F7C', 'traje': 'E2BC92', 'guante': 'C9A27F', 'turquesa': '408D8C', 'turquesa-osc': '357A79',
                  'piel': '94503D', 'piel-osc': '94503D', 'pelo': '232121', 'naranja': 'C9641A',
                  'blanco': 'D9C4B8', 'vinotinto': '742F36', 'rubor': 'C9604A'},
        # orden de pintado (de atrás hacia adelante)
        'orden': ['traje', 'traje-sombra', 'guante', 'turquesa-osc', 'turquesa', 'piel-osc', 'piel', 'rubor', 'naranja', 'blanco',
                  'vinotinto', 'pelo'],
        'ojos': {'zona': (120, 150, 230, 330), 'iris': 'vinotinto', 'blanco': 'blanco', 'aro': '94503D', 'piel': 'piel'},
        'pies': 'guante',
        # partes animables (coordenadas de la referencia). Se asignan en orden; 'cuerpo' es el resto.
        'partes': {
            'cabeza': {'poligono': [(120, 20), (345, 20), (345, 262), (120, 262)],
                       'excluir': ['traje', 'traje-sombra'], 'pivote': (232, 252), 'solapa': 6},
            # el brazo empieza en el borde exterior de la tira turquesa (la tira es del torso)
            'brazo-izq': {'poligono': [(112, 284), (147, 386), (147, 470), (146, 580), (40, 580), (40, 330)],
                          'pivote': (128, 318), 'solapa': 7},
            'brazo-der': {'poligono': [(352, 284), (317, 386), (317, 470), (318, 515), (300, 520), (300, 645),
                                       (440, 645), (440, 330)], 'pivote': (336, 318), 'solapa': 7,
                          'excluir_desde': (470, ['traje']), 'semilla_bajo': (365, 595, 548)},
        },
        'cara_en': 'cabeza',
        # detrás de la bolsa: se reconstruye la pierna derecha reflejando la izquierda (eje en el cierre del traje)
        'espejo': {'parte': 'brazo-der', 'cx': 232.5, 'desde_y': 545},
        'nariz': {'centro': (233, 183), 'radio': 16, 'color': 'A85E44', 'umbral': 3},
        'base': 'E2BC92',
    },
}

hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


def lab(rgb):
    return cv2.cvtColor(rgb.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(rgb.shape).astype(np.float32)


def majority(labels, n, size):
    votes = np.stack([cv2.blur((labels == i).astype(np.float32), (size, size)) for i in range(n)], -1)
    return votes.argmax(-1)


def potrace_path(mask, scale, turdsize, alphamax=1.0, opttolerance=0.2):
    """Traza una máscara con potrace y devuelve el atributo d (coordenadas de la referencia)."""
    if not mask.any():
        return ''
    bm = potrace.Bitmap(~mask)  # potracer trata True como blanco
    plist = bm.trace(turdsize=turdsize, alphamax=alphamax, opticurve=True, opttolerance=opttolerance)
    f = lambda p: f'{p.x / scale:.2f} {p.y / scale:.2f}'
    out = []
    for curve in plist:
        d = [f'M{f(curve.start_point)}']
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f'L{f(seg.c)} L{f(seg.end_point)}')
            else:
                d.append(f'C{f(seg.c1)} {f(seg.c2)} {f(seg.end_point)}')
        out.append(' '.join(d) + ' Z')
    return ' '.join(out)


def fit_circle(xy):
    x, y = xy[:, 0], xy[:, 1]
    A = np.c_[2 * x, 2 * y, np.ones(len(x))]
    cx, cy, c = np.linalg.lstsq(A, x ** 2 + y ** 2, rcond=None)[0]
    return cx, cy, np.sqrt(c + cx ** 2 + cy ** 2)


def aplanar_svg(fragmento):
    """Convierte un fragmento SVG con rect, círculos, elipses y transformaciones en <path> sin transformaciones,
    para que el generador de Lottie pueda leerlo tal cual."""
    import svgelements as se
    import io as _io
    doc = se.SVG.parse(_io.StringIO(f'<svg xmlns="http://www.w3.org/2000/svg">{fragmento}</svg>'), reify=True)
    out = []
    for el in doc.elements():
        if not isinstance(el, se.Shape) or isinstance(el, se.SVG):
            continue
        path = se.Path(el)
        path.reify()
        # solo M, L, C, Z (los arcos y cuadráticas pasan a cúbicas) para el generador de Lottie
        f2 = lambda p: f'{p.x:.2f} {p.y:.2f}'
        parts_d = []
        for seg in path.segments():
            if isinstance(seg, se.Move):
                parts_d.append(f'M{f2(seg.end)}')
            elif isinstance(seg, se.Close):
                parts_d.append('Z')
            elif isinstance(seg, se.Line):
                parts_d.append(f'L{f2(seg.end)}')
            elif isinstance(seg, se.CubicBezier):
                parts_d.append(f'C{f2(seg.control1)} {f2(seg.control2)} {f2(seg.end)}')
            elif isinstance(seg, se.QuadraticBezier):
                c1 = seg.start + (seg.control - seg.start) * (2 / 3)
                c2 = seg.end + (seg.control - seg.end) * (2 / 3)
                parts_d.append(f'C{f2(c1)} {f2(c2)} {f2(seg.end)}')
            elif isinstance(seg, se.Arc):
                for cb in seg.as_cubic_curves():
                    parts_d.append(f'C{f2(cb.control1)} {f2(cb.control2)} {f2(cb.end)}')
        d = ' '.join(parts_d)
        if not d:
            continue
        fill = el.fill.hex if el.fill is not None and el.fill.value is not None else 'none'
        attrs = f' fill="{fill}"'
        if el.stroke is not None and el.stroke.value is not None and el.stroke_width:
            sw = el.stroke_width
            attrs += f' stroke="{el.stroke.hex}" stroke-width="{sw:.2f}" stroke-linecap="round" stroke-linejoin="round"'
        out.append(f'<path d="{d}"{attrs}/>')
    return ''.join(out)


def centerline_strokes(cfg, S, H, W, fig, labels, names, nearest, groups, part_masks, eyes):
    """Líneas de la referencia -> trazos por su línea central, de grosor parejo y puntas redondeadas.

    1) máscara de línea limpia, 2) esqueleto, 3) grafo de ramas (skan) y poda de espigas,
    4) grosor = 2 x mediana de la transformada de distancia, 5) suavizado + curvas,
    6) color = borde (tono oscuro) del relleno vecino dominante, 7) se reparte por parte animable.
    """
    from skan import Skeleton, summarize
    from skimage.morphology import skeletonize, remove_small_objects
    from skimage.measure import approximate_polygon
    line_ids = [names.index(n) for n in names if cfg['paleta'][n][2] == 'linea']
    if cfg.get('lineas_por_contraste') is not None:
        # black-hat: trazos delgados más oscuros que su entorno, sin importar su color
        Lc = cfg['_L'][:, :, 0]
        r = int(cfg['lineas_por_contraste'] * S)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
        bh = cv2.morphologyEx(Lc, cv2.MORPH_BLACKHAT, k)
        lm = (bh > cfg.get('contraste_min', 14)) & fig
        lm = ndi.binary_opening(lm, iterations=1)
    else:
        lm = np.isin(labels, line_ids) & fig
    # los ojos y la nariz se dibujan como formas limpias: sus líneas no se trazan
    yy, xx = np.mgrid[:H, :W]
    for ex, ey, er, *_ in eyes:
        lm &= (xx - ex * S) ** 2 + (yy - ey * S) ** 2 > ((er + 3.5) * S) ** 2
    if cfg.get('nariz'):
        nx, ny = cfg['nariz']['centro']
        lm &= (xx - nx * S) ** 2 + (yy - ny * S) ** 2 > ((cfg['nariz']['radio'] + 1) * S) ** 2
    lm &= ~ndi.binary_dilation(cfg.get('_det_void', np.zeros_like(lm)), iterations=S)
    for poly in cfg.get('sin_lineas', []):
        clases = None
        if isinstance(poly, dict):
            poly, clases = poly['poligono'], poly.get('clases')
        z = np.zeros((H, W), np.uint8)
        cv2.fillPoly(z, [np.array([[x * S, y * S] for x, y in poly], np.int32)], 1)
        z = z.astype(bool)
        if clases:  # solo las líneas que bordean esas clases (p. ej. pelo y piel, no el cuello del traje)
            z &= np.isin(nearest, [names.index(c) for c in clases])
        lm &= ~z
    lm = ndi.binary_closing(lm, iterations=S)
    lm = remove_small_objects(lm, 30 * S * S)
    dt = ndi.distance_transform_edt(lm)
    sk = skeletonize(lm)
    if not sk.any():
        return {g: [] for g, _ in groups}
    skel = Skeleton(sk)
    summ = summarize(skel, separator='-')
    gid = np.zeros((H, W), np.int16)
    gnames = [g for g, _ in groups]
    for k, (pname, m) in enumerate(part_masks.items()):
        gid[m] = gnames.index(pname)
    fill_hex = {cfg['paleta'][n][1]: n for n in names if cfg['paleta'][n][2] == 'relleno'}
    min_w = cfg.get('trazo_min', 1.6)
    out = {g: [] for g in gnames}
    f = lambda v: f'{v:.2f}'
    for i in range(skel.n_paths):
        btype = summ['branch-type'].iloc[i]
        blen = summ['branch-distance'].iloc[i]
        if btype == 1 and blen < cfg.get('espiga', 7) * S:      # espiga en una esquina
            continue
        if blen < 4 * S:
            continue
        co = skel.path_coordinates(i).astype(float)  # (fila, columna)
        closed = btype == 3
        width = max(min_w, 2 * float(np.median(dt[co[:, 0].astype(int), co[:, 1].astype(int)])) / S)
        # color: borde del relleno vecino que más aparece a lo largo de la rama
        vals, counts = np.unique(nearest[co[:, 0].astype(int), co[:, 1].astype(int)], return_counts=True)
        fill_name = names[vals[np.argmax(counts)]]
        col = cfg['borde'].get(fill_name, cfg['paleta'][fill_name][1] or '000000')
        sig = 1.6 * S
        mode = 'wrap' if closed else 'nearest'
        sm = np.stack([ndi.gaussian_filter1d(co[:, 0], sig, mode=mode), ndi.gaussian_filter1d(co[:, 1], sig, mode=mode)], 1)
        if not closed:
            sm[0], sm[-1] = co[0], co[-1]
        g_of = gid[co[:, 0].astype(int), co[:, 1].astype(int)].astype(int)
        # filtro de moda: un cambio de parte solo cuenta si dura al menos ~12 px de la referencia
        win = max(3, int(12 * S))
        if len(g_of) > win:
            sm_g = g_of.copy()
            for j in range(len(g_of)):
                a, b = max(0, j - win // 2), min(len(g_of), j + win // 2 + 1)
                sm_g[j] = np.bincount(g_of[a:b]).argmax()
            g_of = sm_g
        elif len(g_of):
            g_of[:] = np.bincount(g_of).argmax()
        # cortar la rama donde cambia de parte animable
        cuts = np.where(np.diff(g_of) != 0)[0] + 1
        for seg_idx, seg in zip(np.split(np.arange(len(sm)), cuts), np.split(sm, cuts)):
            if len(seg) < 3:
                continue
            g = gnames[g_of[seg_idx[0]]]
            poly = approximate_polygon(seg, 0.35 * S)
            pts = [(x / S, y / S) for y, x in poly]
            if len(pts) < 2:
                continue
            d = [f'M{f(pts[0][0])} {f(pts[0][1])}']
            n_ = len(pts)
            for j in range(n_ - 1):
                p0 = pts[j - 1] if j > 0 else pts[j]
                p1, p2 = pts[j], pts[j + 1]
                p3 = pts[j + 2] if j + 2 < n_ else pts[j + 1]
                c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
                c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
                d.append(f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}')
            if closed and len(cuts) == 0:
                d.append('Z')
            out[g].append(f'<path d="{" ".join(d)}" fill="none" stroke="#{col}" stroke-width="{width:.2f}" '
                          f'stroke-linecap="round" stroke-linejoin="round"/>')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('personaje')
    ap.add_argument('--escala', type=int, default=2)
    ap.add_argument('--qa', default=None, help='PNG de comparación lado a lado')
    args = ap.parse_args()
    cfg = PERSONAJES[args.personaje]
    S = args.escala
    t0 = time.time()

    # 1. recorte, reescalado y aplanado de color
    src = np.asarray(Image.open(cfg['src']).convert('RGB').crop(cfg['box']))
    big = cv2.resize(src, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
    flat = cv2.pyrMeanShiftFiltering(cv2.cvtColor(big, cv2.COLOR_RGB2BGR), sp=4 * S, sr=18)
    flat = cv2.cvtColor(flat, cv2.COLOR_BGR2RGB)
    H, W = flat.shape[:2]

    # 2. clasificación en Lab + mayoría
    names = list(cfg['paleta'])
    roles = [cfg['paleta'][n][2] for n in names]
    pal = lab(np.stack([hexrgb(cfg['paleta'][n][0]) for n in names])[None])[0]
    L = lab(flat)
    cfg['_L'] = L
    dist = ((L[:, :, None, :] - pal[None, None]) ** 2).sum(-1)
    labels = majority(dist.argmin(-1), len(names), 2 * S + 1)
    is_ = lambda n: labels == names.index(n)

    # 3. figura: lo que no se alcanza desde el borde pasando por fondo/piso
    open_bg = np.isin(labels, [i for i, r in enumerate(roles) if r in ('fondo', 'piso')])
    cc, _ = ndi.label(open_bg)
    border = set(np.unique(np.r_[cc[0], cc[-1], cc[:, 0], cc[:, -1]])) - {0}
    fig = ~np.isin(cc, list(border))
    fig = ndi.binary_opening(fig, iterations=S)
    cc, n = ndi.label(fig)
    fig = cc == (np.argmax(ndi.sum(fig, cc, range(1, n + 1))) + 1)
    # huecos grandes de fondo encerrados (entre piernas) siguen siendo fondo
    pocket = is_('fondo') & fig
    cc, n = ndi.label(pocket)
    for i in range(1, n + 1):
        m = cc == i
        if m.sum() > 400 * S * S:
            fig &= ~ndi.binary_dilation(m, iterations=S)
    # el piso que se coló en la figura (borde inferior de las botas) vuelve a ser piso
    band = np.zeros((H, W), bool)
    band[int(H * 0.85):] = True
    fig &= ~(is_('piso') & band & ~ndi.binary_erosion(fig, iterations=3 * S))
    if cfg.get('pies'):
        # las botas son lo que encierra su propio contorno (el relleno se confunde con el piso)
        outline = ndi.binary_closing(is_('linea') & band, iterations=2 * S)
        top = int(H * 0.85)
        outline[top:top + 2] |= fig[top:top + 2]  # cierra la caña de la bota con el corte de la banda
        feet = ndi.binary_fill_holes(outline)
        fig &= ~band | ndi.binary_dilation(feet, iterations=S)
        lower = fig & band
        fig = (fig & ~band) | ndi.binary_opening(lower, structure=np.ones((4 * S + 1, 4 * S + 1)))
    fig = ndi.binary_opening(fig, structure=np.ones((2 * S + 1, 2 * S + 1)))
    cc, n = ndi.label(fig)
    fig = cc == (np.argmax(ndi.sum(fig, cc, range(1, n + 1))) + 1)
    if cfg.get('piso_interior'):
        top = int(H * 0.85)
        inner_floor = is_('piso') & fig
        inner_floor[top:] = False
        labels[inner_floor] = names.index(cfg['piso_interior'])
    # dentro de la figura, el fondo que se confunde con el relleno más claro es ese relleno
    labels[is_('fondo') & fig] = names.index(cfg['orden'][0])

    # 3b. correcciones locales de clasificación: en una zona, ciertas clases pasan a otra
    for regla in cfg.get('corregir', []):
        zona = np.zeros((H, W), np.uint8)
        cv2.fillPoly(zona, [np.array([[x * S, y * S] for x, y in regla['zona']], np.int32)], 1)
        de = np.isin(labels, [names.index(c) for c in regla['de']])
        labels[zona.astype(bool) & de & fig] = names.index(regla['a'])

    # 4. líneas -> tono más oscuro del relleno vecino
    fill_ids = [i for i, r in enumerate(roles) if r == 'relleno']
    fillmask = np.isin(labels, fill_ids) & fig
    _, (iy, ix) = ndi.distance_transform_edt(~fillmask, return_indices=True)
    nearest = labels[iy, ix]
    color = np.full((H, W), '', object)
    for i in fill_ids:
        color[(labels == i) & fig] = cfg['paleta'][names[i]][1]
    linepx = fig & ~fillmask
    trazo = cfg.get('lineas') == 'trazo'
    for i in fill_ids:
        color[linepx & (nearest == i)] = cfg['paleta'][names[i]][1] if trazo else cfg['borde'].get(names[i], cfg['paleta'][names[i]][1])
    color[~fig] = ''
    line_names = [n for n in names if cfg['paleta'][n][2] == 'linea']

    # 4c. detalles dibujados a mano (insignia, tablet...): su zona se vacía en el calco
    det_void = np.zeros((H, W), bool)
    for det in cfg.get('detalles', []):
        if det.get('zona') and det.get('vaciar'):
            z = np.zeros((H, W), np.uint8)
            for zk in ('zona', 'zona2'):
                if det.get(zk):
                    cv2.fillPoly(z, [np.array([[x * S, y * S] for x, y in det[zk]], np.int32)], 1)
            cls = det['vaciar']
            cols_v = [cfg['paleta'][c][1] for c in cls] + [cfg['borde'][c] for c in cls if c in cfg['borde']]
            m = z.astype(bool) & (np.isin(color, cols_v) | (linepx & np.isin(nearest, [names.index(c) for c in cls])))
            if det.get('lineas_todas'):
                m |= z.astype(bool) & linepx
            if det.get('rellenar'):
                color[m] = cfg['paleta'][det['rellenar']][1]  # se tapa con el relleno vecino (no queda hueco)
                continue
            color[m] = ''
            det_void |= m
    cfg['_det_void'] = det_void

    # 5. limpieza de islas: componentes diminutos toman el color vecino dominante
    minarea = 6 * S * S
    cols = [c for c in np.unique(color) if c]
    for c in cols:
        cc, n = ndi.label(color == c)
        if n == 0:
            continue
        sizes = ndi.sum(np.ones_like(cc), cc, range(1, n + 1))
        for i in np.where(sizes < minarea)[0] + 1:
            m = cc == i
            ring = ndi.binary_dilation(m, iterations=1) & ~m & fig & ~det_void
            vals, counts = np.unique(color[ring], return_counts=True)
            if len(vals):
                color[m] = vals[np.argmax(counts)]

    eyes = []
    # 4b. ojos: esclera, pupila y brillo como círculos
    eye_svg = ''
    if cfg.get('ojos'):
        y0, x0, y1, x1 = [v * S for v in cfg['ojos']['zona']]
        zone = np.zeros((H, W), bool)
        zone[y0:y1, x0:x1] = True
        wh = is_(cfg['ojos']['blanco']) & zone
        ir = is_(cfg['ojos']['iris']) & zone
        cc, n = ndi.label(ndi.binary_closing(wh | (ir & ndi.binary_dilation(wh, iterations=4 * S)), iterations=2 * S))
        for i in range(1, n + 1):
            m = ndi.binary_fill_holes(cc == i)
            if m.sum() < 150 * S * S:
                continue
            b = np.argwhere(m & ~ndi.binary_erosion(m))[:, ::-1].astype(float)
            ex, ey, er = fit_circle(b)
            pm = ir & m
            pb = np.argwhere(pm & ~ndi.binary_erosion(pm))[:, ::-1].astype(float)
            px, py, pr = fit_circle(pb) if len(pb) > 8 else (ex, ey, er * 0.6)
            eyes.append((ex / S, ey / S, er / S, px / S, py / S, min(pr / S, er / S * 0.72)))
        # el mosaico debajo de cada ojo pasa a piel: el ojo se dibuja limpio encima
        yy, xx = np.mgrid[:H, :W]
        skin_fill = cfg['paleta'][cfg['ojos']['piel']][1]
        for ex, ey, er, *_ in eyes:
            r2 = (xx - ex * S) ** 2 + (yy - ey * S) ** 2
            color[(r2 <= ((er + 2.5) * S) ** 2) & fig] = skin_fill
            keep = is_('rubor') if 'rubor' in names else np.zeros_like(fig)
            color[(r2 <= ((er * 1.55) * S) ** 2) & fig & ~keep] = skin_fill
        for k_eye, (ex, ey, er, px, py, pr) in enumerate(sorted(eyes)):
            tx, ty, tr = px - pr * 0.42, py - pr * 0.45, pr * 0.34
            eye_svg += (f'<g id="ojo-{("izq", "der")[k_eye]}" class="ojo"><circle cx="{ex:.2f}" cy="{ey:.2f}" r="{er + 1.4:.2f}" fill="#{cfg["ojos"]["aro"]}"/>'
                        f'<circle cx="{ex:.2f}" cy="{ey:.2f}" r="{er:.2f}" fill="#FFFFFF"/>'
                        f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{pr:.2f}" fill="#{cfg["paleta"][cfg["ojos"]["iris"]][1]}"/>'
                        f'<circle cx="{tx:.2f}" cy="{ty:.2f}" r="{tr:.2f}" fill="#FFFFFF"/></g>')

    # 4c. nariz (rasgo firma de Duolingo): forma redondeada un poco más oscura que la piel
    nose_svg = ''
    if cfg.get('nariz'):
        nx, ny, rad = [v * S for v in cfg['nariz']['centro']] + [cfg['nariz']['radio'] * S]
        skinL = L[is_(cfg['ojos']['piel']) & fig][:, 0]
        win = np.zeros((H, W), bool)
        win[int(ny - rad):int(ny + rad), int(nx - rad):int(nx + rad)] = True
        dark = win & (L[:, :, 0] < np.median(skinL) - cfg['nariz'].get('umbral', 4)) & is_(cfg['ojos']['piel'])
        dark = ndi.binary_opening(dark, iterations=S)
        cc, n = ndi.label(dark)
        if n:
            m = cc == (np.argmax(ndi.sum(dark, cc, range(1, n + 1))) + 1)
            pts = np.argwhere(m)[:, ::-1].astype(np.float32)
            (cx, cy), (w_, h_), ang = cv2.fitEllipse(pts)
            rim = cfg['nariz'].get('borde')
            if rim:
                nose_svg += (f'<ellipse cx="{cx / S:.2f}" cy="{cy / S:.2f}" rx="{w_ / 2 / S + 1.4:.2f}" ry="{h_ / 2 / S + 1.4:.2f}" '
                             f'transform="rotate({ang:.1f} {cx / S:.2f} {cy / S:.2f})" fill="#{rim}"/>')
            nose_svg += (f'<ellipse id="nariz" cx="{cx / S:.2f}" cy="{cy / S:.2f}" rx="{w_ / 2 / S:.2f}" ry="{h_ / 2 / S:.2f}" '
                         f'transform="rotate({ang:.1f} {cx / S:.2f} {cy / S:.2f})" fill="#{cfg["nariz"]["color"]}"/>')

    # 6. orden de pintado: base (silueta) y luego capas por color, de atrás hacia adelante
    order_cols = []
    for n_ in cfg['orden']:
        for c in (cfg['borde'].get(n_), cfg['paleta'][n_][1]):
            if c and c not in order_cols and (color == c).any():
                order_cols.append(c)
    order_cols += [c for c in cols if c not in order_cols]
    under = 2 * S

    def layers_for(colarr, region):
        out = []
        for k, c in enumerate(order_cols):
            m = colarr == c
            above = np.isin(colarr, order_cols[k + 1:])
            m = m | (ndi.binary_dilation(m, iterations=under) & above)  # se mete debajo de las capas de encima
            out.append((c, m & region))
        return out
    layers = layers_for(color, fig)

    # 7. partes animables (cabeza, brazos...) y trazado con potrace por parte
    def poly_mask(pts):
        m = np.zeros((H, W), np.uint8)
        cv2.fillPoly(m, [np.array([[x * S, y * S] for x, y in pts], np.int32)], 1)
        return m.astype(bool)
    part_masks = {}
    taken = np.zeros((H, W), bool)
    for pname, pdef in cfg.get('partes', {}).items():
        m = poly_mask(pdef['poligono']) & fig & ~taken
        if pdef.get('excluir'):
            m &= ~np.isin(color, [cfg['paleta'][c][1] for c in pdef['excluir']] + [cfg['borde'][c] for c in pdef['excluir'] if c in cfg['borde']])
            m = ndi.binary_opening(m, iterations=S)
            cc, n = ndi.label(m)
            if n:
                m = cc == (np.argmax(ndi.sum(m, cc, range(1, n + 1))) + 1)
            m = ndi.binary_fill_holes(m)
        if pdef.get('excluir_en'):
            zona = poly_mask(pdef['excluir_en']['poligono'])
            clases = pdef['excluir_en']['clases']
            cols_x = [cfg['paleta'][c][1] for c in clases] + [cfg['borde'][c] for c in clases if c in cfg['borde']]
            m &= ~(zona & np.isin(color, cols_x))
            m = ndi.binary_opening(m, iterations=S)
            cc, n = ndi.label(m)
            if n:
                m = cc == (np.argmax(ndi.sum(m, cc, range(1, n + 1))) + 1)
        if pdef.get('excluir_desde'):
            y_cut, clases = pdef['excluir_desde']
            cols_x = [cfg['paleta'][c][1] for c in clases] + [cfg['borde'][c] for c in clases if c in cfg['borde']]
            low = np.zeros((H, W), bool)
            low[int(y_cut * S):] = True
            m &= ~(low & np.isin(color, cols_x))
            m = ndi.binary_opening(m, iterations=S)
            if pdef.get('semilla_bajo'):
                # abajo solo queda el objeto conectado a la semilla (la bolsa), sin restos de la pierna
                sx, sy, sdesde = [int(v * S) for v in pdef['semilla_bajo']]
                low = np.zeros((H, W), bool)
                low[sdesde:] = True
                lowpart = m & low
                core = ndi.binary_erosion(lowpart, iterations=2 * S)
                cc, _ = ndi.label(core)
                keep = ndi.binary_dilation(cc == cc[sy, sx], iterations=2 * S) & lowpart if cc[sy, sx] else lowpart
                m = (m & ~low) | keep
        part_masks[pname] = m
        taken |= m
    body = fig & ~taken
    # el cuerpo se extiende por debajo de las partes (para que al moverlas no quede un hueco)
    for pname, pdef in cfg.get('partes', {}).items():
        if pdef.get('solapa'):
            body |= part_masks[pname] & ndi.binary_dilation(fig & ~taken, iterations=pdef['solapa'] * S)
    # lo que queda detrás de una parte (p. ej. la pierna detrás de la bolsa) se reconstruye por simetría
    body_color = color
    if cfg.get('espejo'):
        e = cfg['espejo']
        cxs = int(round(e['cx'] * 2 * S))
        region = part_masks[e['parte']].copy()
        region[: int(e['desde_y'] * S)] = False
        yy, xx = np.nonzero(region)
        mx = cxs - xx
        ok = (mx >= 0) & (mx < W)
        yy, xx, mx = yy[ok], xx[ok], mx[ok]
        src_ok = fig[yy, mx] & ~np.any([part_masks[q][yy, mx] for q in part_masks], axis=0)
        body_color = color.copy()
        body_color[yy[src_ok], xx[src_ok]] = color[yy[src_ok], mx[src_ok]]
        add = np.zeros((H, W), bool)
        add[yy[src_ok], xx[src_ok]] = True
        body |= add
    groups = [('cuerpo', body)] + list(part_masks.items())

    def trace_group(gname, gmask):
        out = [f'<path class="silueta" d="{potrace_path(gmask, S, 10 * S)}" fill="#{cfg["base"]}"/>']
        for c, m in (layers_for(body_color, fig | body) if gname == 'cuerpo' else layers):
            d = potrace_path(m & gmask, S, 4 * S)
            if d:
                out.append(f'<path d="{d}" fill="#{c}" fill-rule="evenodd"/>')
        return out

    strokes_by_group = {g: [] for g, _ in groups}
    if trazo:
        strokes_by_group = centerline_strokes(cfg, S, H, W, fig, labels, names, nearest, groups, part_masks,
                                              eyes if cfg.get('ojos') else [])

    parts = []
    for gname, gmask in groups:
        dets = [d for d in cfg.get('detalles', []) if d['parte'] == gname]
        traced = trace_group(gname, gmask)
        inner = traced[:1] + [aplanar_svg(d['svg']) for d in dets if d.get('debajo')] + traced[1:] \
            + strokes_by_group.get(gname, []) + [aplanar_svg(d['svg']) for d in dets if not d.get('debajo')]
        if gname == cfg.get('cara_en'):
            inner += [nose_svg, eye_svg]
        piv = cfg.get('partes', {}).get(gname, {}).get('pivote')
        attr = f' data-pivote="{piv[0]} {piv[1]}"' if piv else ''
        parts.append(f'<g id="{gname}"{attr}>' + ''.join(inner) + '</g>')

    # 8b. piso como elipse
    floor = ''
    if 'piso' in names:
        fl = ndi.binary_opening(is_('piso') & ~ndi.binary_dilation(fig, iterations=2 * S), iterations=3 * S)
        fl[: int(H * 0.7)] = False
        if fl.any():
            fy, fx = np.where(fl)
            floor = (f'<ellipse id="sombra-piso" cx="{(fx.min() + fx.max()) / 2 / S:.1f}" cy="{(fy.min() + fy.max()) / 2 / S:.1f}" '
                     f'rx="{(fx.max() - fx.min()) / 2 / S:.1f}" ry="{(fy.max() - fy.min()) / 2 / S:.1f}" fill="#{cfg["paleta"]["piso"][1]}"/>')

    w0, h0 = cfg['box'][2] - cfg['box'][0], cfg['box'][3] - cfg['box'][1]
    face = '' if cfg.get('cara_en') else nose_svg + eye_svg
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w0} {h0}">{floor}' + ''.join(parts) + face + '</svg>'
    open(cfg['out'], 'w').write(svg)

    # 9. control de calidad
    bgc = '#' + cfg['paleta']['fondo'][0]
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=w0, background_color=bgc)
    import io
    mine = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(np.float32)
    ref = src.astype(np.float32)
    dE = np.sqrt(((lab(mine.astype(np.uint8)) - lab(ref.astype(np.uint8))) ** 2).sum(-1))
    figsmall = cv2.resize(fig.astype(np.uint8), (w0, h0), interpolation=cv2.INTER_NEAREST).astype(bool)
    stats = {
        'kb': round(len(svg) / 1024, 1),
        'capas': len(layers),
        'dE_medio_figura': round(float(dE[figsmall].mean()), 2),
        'px_dE<10_%': round(float((dE[figsmall] < 10).mean() * 100), 1),
        'segundos': round(time.time() - t0, 1),
    }
    print(json.dumps(stats))
    if args.qa:
        s = Image.new('RGB', (w0 * 2 + 10, h0), 'white')
        s.paste(Image.fromarray(src), (0, 0))
        s.paste(Image.fromarray(mine.astype(np.uint8)), (w0 + 10, 0))
        s.save(args.qa)


if __name__ == '__main__':
    sys.exit(main())
