"""Cofre de Ceti: el premio de cada zona del mapa de un planeta.

Redibujado con formas medidas del boceto de Gemini `assets/brand/bocetos/cofre-01-hoja.png` (cofre de la
izquierda), como los planetas: es geométrico, así que se dibuja en vez de vectorizarlo. Va por capas para
animarlo: la tapa cerrada y la abierta giran sobre la bisagra (y = BISAGRA), el candado salta y las monedas
salen del interior.

Contrato: solo <path>, `d` con M L C Z absolutos y color #RRGGBB en cada forma.

Uso, desde scripts/marca/:
    ~/.venvs/mascot/bin/python -m cofre.cofre      # SVG en assets/brand/cofre/ y las piezas para la app
"""
from __future__ import annotations

import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
SALIDA = RAIZ / 'assets/brand/cofre'
PIEZAS_TS = RAIZ / 'src/features/orbita/components/cofre/piezas.ts'

LADO = 200
BISAGRA = 97

NARANJA = '#FD7B0D'
NARANJA_CLARO = '#FB9514'
NARANJA_LADO = '#CF5501'
NARANJA_OSCURO = '#AC3B00'
NARANJA_BORDE = '#CB5B01'
NARANJA_HUECO = '#B44700'
CALCOMANIA = '#D25D02'
ORO = '#F7C95F'
ORO_BORDE = '#E5A438'
ORO_OSCURO = '#CC870C'
MARINO = '#1E1E3E'
MARINO_HONDO = '#14142C'


def f(v: float) -> str:
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


K = 0.5523  # constante de las cúbicas de un cuarto de círculo


def rrect(x: float, y: float, w: float, h: float, r: float | tuple[float, float, float, float]) -> str:
    """Rectángulo con esquinas redondeadas (r o (sup-izq, sup-der, inf-der, inf-izq))."""
    a, b, c, d = (r, r, r, r) if isinstance(r, (int, float)) else r
    x2, y2 = x + w, y + h
    p = [f'M{f(x + a)} {f(y)}', f'L{f(x2 - b)} {f(y)}']
    if b:
        p.append(f'C{f(x2 - b + b * K)} {f(y)} {f(x2)} {f(y + b - b * K)} {f(x2)} {f(y + b)}')
    p.append(f'L{f(x2)} {f(y2 - c)}')
    if c:
        p.append(f'C{f(x2)} {f(y2 - c + c * K)} {f(x2 - c + c * K)} {f(y2)} {f(x2 - c)} {f(y2)}')
    p.append(f'L{f(x + d)} {f(y2)}')
    if d:
        p.append(f'C{f(x + d - d * K)} {f(y2)} {f(x)} {f(y2 - d + d * K)} {f(x)} {f(y2 - d)}')
    p.append(f'L{f(x)} {f(y + a)}')
    if a:
        p.append(f'C{f(x)} {f(y + a - a * K)} {f(x + a - a * K)} {f(y)} {f(x + a)} {f(y)}')
    return ' '.join(p) + ' Z'


def circulo(cx: float, cy: float, r: float) -> str:
    k = r * K
    return (f'M{f(cx + r)} {f(cy)} C{f(cx + r)} {f(cy + k)} {f(cx + k)} {f(cy + r)} {f(cx)} {f(cy + r)} '
            f'C{f(cx - k)} {f(cy + r)} {f(cx - r)} {f(cy + k)} {f(cx - r)} {f(cy)} '
            f'C{f(cx - r)} {f(cy - k)} {f(cx - k)} {f(cy - r)} {f(cx)} {f(cy - r)} '
            f'C{f(cx + k)} {f(cy - r)} {f(cx + r)} {f(cy - k)} {f(cx + r)} {f(cy)} Z')


def elipse(cx: float, cy: float, rx: float, ry: float) -> str:
    kx, ky = rx * K, ry * K
    return (f'M{f(cx + rx)} {f(cy)} C{f(cx + rx)} {f(cy + ky)} {f(cx + kx)} {f(cy + ry)} {f(cx)} {f(cy + ry)} '
            f'C{f(cx - kx)} {f(cy + ry)} {f(cx - rx)} {f(cy + ky)} {f(cx - rx)} {f(cy)} '
            f'C{f(cx - rx)} {f(cy - ky)} {f(cx - kx)} {f(cy - ry)} {f(cx)} {f(cy - ry)} '
            f'C{f(cx + kx)} {f(cy - ry)} {f(cx + rx)} {f(cy - ky)} {f(cx + rx)} {f(cy)} Z')


def estrella(cx: float, cy: float, r: float, interior: float = 0.48) -> str:
    """Estrella de 5 puntas con las puntas apenas redondeadas (polígono)."""
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * interior
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts) + ' Z'


def planetita(cx: float, cy: float, r: float, color: str) -> list[tuple[str, str]]:
    """Calcomanía de planeta: bola y anillo (el anillo es una elipse fina, plana)."""
    return [(elipse(cx, cy + r * 0.15, r * 1.75, r * 0.42), color), (circulo(cx, cy - r * 0.1, r * 0.8), color)]


def moneda(cx: float, cy: float, r: float) -> list[tuple[str, str]]:
    """La moneda de Ceti (MonedaCeti: borde, cara y la C), escalada desde su caja de 24."""
    s = r / 10
    c = [(14.6, 9.3), (12.6, 7.4), (8.4, 9.2), (8.4, 12), (8.4, 14.8), (12.6, 16.6), (14.6, 14.7),
         (13.3, 13.5), (12, 14.8), (10.1, 13.6), (10.1, 12), (10.1, 10.4), (12, 9.2), (13.3, 10.5)]
    q = [(cx + (x - 12) * s, cy + (y - 12) * s) for x, y in c]
    letra = (f'M{f(q[0][0])} {f(q[0][1])} C{f(q[1][0])} {f(q[1][1])} {f(q[2][0])} {f(q[2][1])} {f(q[3][0])} {f(q[3][1])} '
             f'C{f(q[4][0])} {f(q[4][1])} {f(q[5][0])} {f(q[5][1])} {f(q[6][0])} {f(q[6][1])} L{f(q[7][0])} {f(q[7][1])} '
             f'C{f(q[8][0])} {f(q[8][1])} {f(q[9][0])} {f(q[9][1])} {f(q[10][0])} {f(q[10][1])} '
             f'C{f(q[11][0])} {f(q[11][1])} {f(q[12][0])} {f(q[12][1])} {f(q[13][0])} {f(q[13][1])} Z')
    return [(circulo(cx, cy, r), ORO_BORDE), (circulo(cx, cy, r * 0.74), ORO), (letra, ORO_BORDE)]


# ── Capas ─────────────────────────────────────────────────────────────────────

def tapa_abierta() -> list[tuple[str, str]]:
    """La tapa vista por dentro, echada hacia atrás sobre la bisagra."""
    return [
        ('M18 99 L10 30 C9.4 24 13 20 19 20 L181 20 C187 20 190.6 24 190 30 L182 99 Z', NARANJA_LADO),
        ('M22 97 L15 31 C14.6 27 17 25 21 25 L179 25 C183 25 185.4 27 185 31 L178 97 Z', NARANJA),
        ('M15 31 C14.6 27 17 25 21 25 L179 25 C183 25 185.4 27 185 31 L184.6 35 L15.4 35 Z', NARANJA_CLARO),
        ('M33 97 L28 42 L172 42 L167 97 Z', MARINO),
        # Extremo del barril a la izquierda, como una C.
        ('M4 99 L4 50 C4 32 12 20 25 20 L31 20 L31 99 Z', NARANJA_LADO),
        ('M11 99 L11 53 C11 40 16 31 24 31 L24 99 Z', NARANJA_HUECO),
    ]


def interior() -> list[tuple[str, str]]:
    return [(rrect(20, 86, 160, 16, 6), MARINO_HONDO)]


def monedas() -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for cx, cy, r in [(138, 52, 14), (98, 70, 15), (64, 84, 15), (128, 82, 15), (160, 88, 14),
                      (36, 92, 14), (82, 94, 15), (112, 94, 15), (146, 96, 14), (52, 100, 14), (172, 101, 13)]:
        out += moneda(cx, cy, r)
    return out


def tapa_cerrada() -> list[tuple[str, str]]:
    out = [
        # Extremo del barril (la cara de la izquierda) con su hueco.
        ('M14 99 L14 76 C14 60 25 46 40 46 L54 46 L54 99 Z', NARANJA_LADO),
        ('M21 99 L21 78 C21 64 27 56 35 56 C43 56 48 64 48 78 L48 99 Z', NARANJA_HUECO),
        # Frente de la tapa: barril con las esquinas de arriba redondas.
        ('M46 99 L46 72 C46 57 55 46 70 46 L160 46 C175 46 186 58 186 74 L186 99 Z', NARANJA),
        ('M46 99 L46 72 C46 57 55 46 70 46 L74 46 L74 99 Z', NARANJA_CLARO),
        # Costillas del barril.
        ('M80 99 L80 64 C80 54 86 47 96 47 L100 47 L100 52.5 L96 52.5 C90 52.5 85.5 57 85.5 64 L85.5 99 Z',
         NARANJA_LADO),
        ('M136 47 L142 47 C152 47 158 54 158 64 L158 99 L152.5 99 L152.5 64 C152.5 57 148 52.5 142 52.5 '
         'L136 52.5 Z', NARANJA_LADO),
        # Correa central con sus calcomanías.
        (rrect(103, 46, 30, 53, (5, 5, 0, 0)), NARANJA_CLARO),
        (estrella(118, 61, 5.8), CALCOMANIA),
    ]
    out += planetita(118, 80, 4.6, CALCOMANIA)
    return out


def cuerpo() -> list[tuple[str, str]]:
    return [
        (rrect(14, 116, 172, 60, 10), NARANJA_BORDE),
        (rrect(14, 116, 40, 58, (0, 0, 0, 10)), NARANJA_LADO),
        (rrect(14, 116, 8, 58, (0, 0, 0, 8)), NARANJA_OSCURO),
        (rrect(54, 116, 124, 52, (0, 0, 8, 0)), NARANJA),
        (rrect(46, 116, 9, 56, 0), NARANJA_OSCURO),
        # Patas: medias cúpulas en las esquinas.
        ('M13 177 L13 169 C13 162 18 157 25 157 C31 157 36 162 36 169 L36 177 Z', '#E96D0B'),
        ('M44 177 L44 167 C44 159 51 153 60 153 C69 153 76 159 76 167 L76 177 Z', NARANJA_CLARO),
        ('M44 177 L44 167 C44 159 51 153 60 153 L60 177 Z', '#E96D0B'),
        ('M164 177 L164 167 C164 160 170 155 177 155 C183 155 187 160 187 167 L187 177 Z', NARANJA_CLARO),
    ]


def franja() -> list[tuple[str, str]]:
    out = [
        (rrect(11, 96, 178, 27, 6), '#CD5C00'),
        (rrect(11, 96, 178, 12.5, (6, 6, 2, 2)), '#FC9512'),
        (rrect(11, 110.5, 178, 11.5, (2, 2, 5, 5)), '#FB9413'),
        (rrect(11, 96, 43, 26, (6, 0, 0, 5)), '#EE8410'),
        (rrect(11, 108.5, 43, 2, 0), '#C25300'),
        (estrella(73, 102.3, 4.6), CALCOMANIA),
        (estrella(172, 102.3, 4.6), CALCOMANIA),
    ]
    out += planetita(93, 102.6, 3.6, CALCOMANIA)
    out += planetita(152, 102.6, 3.6, CALCOMANIA)
    return out


def candado() -> list[tuple[str, str]]:
    return [
        ('M113 124 L113 104 C113 96 118 91 125 91 C132 91 137 96 137 104 L137 124 L130.5 124 L130.5 104 '
         'C130.5 100 128.5 97.5 125 97.5 C121.5 97.5 119.5 100 119.5 104 L119.5 124 Z', ORO_BORDE),
        (rrect(103, 117, 45, 44, 12), ORO_OSCURO),
        (rrect(106, 116, 42, 40, 12), '#F4BE48'),
        (estrella(127, 135.5, 10, 0.5), ORO_OSCURO),
    ]


CAPAS = {
    'tapaAbierta': tapa_abierta,
    'interior': interior,
    'monedas': monedas,
    'tapaCerrada': tapa_cerrada,
    'cuerpo': cuerpo,
    'franja': franja,
    'candado': candado,
}
CERRADO = ['tapaCerrada', 'cuerpo', 'franja', 'candado']
ABIERTO = ['tapaAbierta', 'interior', 'monedas', 'cuerpo', 'franja']
VACIO = ['tapaAbierta', 'interior', 'cuerpo', 'franja']


def svg(capas: list[str]) -> str:
    grupos = []
    for nombre in capas:
        formas = ''.join(f'<path d="{d}" fill="{c}"/>' for d, c in CAPAS[nombre]())
        grupos.append(f'<g id="{nombre}">{formas}</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LADO} {LADO}" width="{LADO}" height="{LADO}">'
            + ''.join(grupos) + '</svg>')


def piezas_ts() -> str:
    lineas = [
        '/**',
        ' * Piezas del cofre de Ceti. GENERADO por scripts/marca/cofre/cofre.py: no se edita a mano.',
        f' * Caja de {LADO}×{LADO}; la tapa gira sobre la bisagra en y = {BISAGRA}.',
        ' */',
        f'export const LADO_COFRE = {LADO};',
        f'export const BISAGRA = {BISAGRA};',
        '',
        'export type Forma = readonly [d: string, color: string];',
        '',
        'export const PIEZAS = {',
    ]
    for nombre, fn in CAPAS.items():
        lineas.append(f'  {nombre}: [')
        for d, c in fn():
            lineas.append(f"    ['{d}', '{c}'],")
        lineas.append('  ],')
    lineas += ['} as const satisfies Record<string, readonly Forma[]>;', '']
    return '\n'.join(lineas)


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / 'cofre-cerrado.svg').write_text(svg(CERRADO))
    (SALIDA / 'cofre-abierto.svg').write_text(svg(ABIERTO))
    (SALIDA / 'cofre-reclamado.svg').write_text(svg(VACIO))
    PIEZAS_TS.parent.mkdir(parents=True, exist_ok=True)
    PIEZAS_TS.write_text(piezas_ts())
    print('ok', SALIDA, PIEZAS_TS)


if __name__ == '__main__':
    main()
