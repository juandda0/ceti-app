"""Constructor común de los planetas de la familia de mundos de Ceti.

Cada planeta es una configuración (un módulo en `mundos/`) con medidas tomadas de su referencia de Gemini:

- `planeta`: disco (`c`, `r`) en el tono de sombra, lado iluminado = intersección con el círculo `luz`, brillos
  (elipses) y `extras` (formas propias del planeta encima del disco, p. ej. pepitas u oro derretido).
- `orbita` (opcional): elipse por la que pasan los satélites; t = 90° es el punto más cercano.
- `linea_orbita` (opcional): trazo fino de la órbita.
- `satelites` (opcional): `n` piezas iguales (monedas, gemas) que recorren la órbita; `avance` es la fracción de
  vuelta que avanzan en un loop (1/n: una posición, así el loop empalma).
- `animacion`: duración del loop (s); opcionales `flotar` (px), `periodo` (s de un vaivén), `inclinar` (°),
  `bamboleo` (° de cada satélite) y `destellos` (por loop). Ver scripts/lottie/mundo-planeta.mjs.

Con órbita, el anillo (línea + satélites) se pinta dos veces: detrás del planeta y delante; encima va
`planeta-tapa`, la parte del planeta del lado de atrás del eje de la órbita, que tapa lo que pasa por detrás.
Sin clip-path ni máscaras, para cumplir el contrato animable y porque rlottie dibuja mal las máscaras al escalar.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from .geometria import (Elipse, Punto, circulo, en_semiplano, forma, lente, moneda, muestrear, poligono, pt,
                        recortar, recortar_poligono)

RAIZ = Path(__file__).resolve().parents[3]
LADO = 960
# El orden de los satélites es circular: cada uno tapa al que va delante en el recorrido (t mayor encima). El
# corte de ese orden va en t = 3π/2, en medio de la mitad de atrás, donde el planeta lo tapa.
CORTE = 1.5 * math.pi


def desplazado(d, o: Punto):
    """Copia de los parámetros con cada centro `c` pasado a coordenadas del SVG (origen en 0, 0)."""
    if isinstance(d, dict):
        return {k: ((v[0] - o[0], v[1] - o[1]) if k == 'c' else desplazado(v, o)) for k, v in d.items()}
    if isinstance(d, list):
        return [desplazado(v, o) for v in d]
    return d


def parametro(e: Elipse, u: float, reparto: float, pasos: int = 2000) -> float:
    """t de la órbita para la fracción u de la vuelta, con `reparto` entre espaciado en t (0) y por arco (1)."""
    ts = [2 * math.pi * k / pasos for k in range(pasos + 1)]
    largo = [0.0]
    for a, b in zip(ts, ts[1:]):
        pa, pb = e.punto(a), e.punto(b)
        largo.append(largo[-1] + math.hypot(pb[0] - pa[0], pb[1] - pa[1]))
    u %= 1.0
    objetivo = u * largo[-1]
    k = next(j for j in range(1, len(largo)) if largo[j] >= objetivo)
    t_arco = ts[k - 1] + (ts[k] - ts[k - 1]) * (objetivo - largo[k - 1]) / (largo[k] - largo[k - 1])
    return (1 - reparto) * 2 * math.pi * u + reparto * t_arco


def satelites(orb: dict, sat: dict) -> list[dict]:
    e = Elipse(orb['c'], orb['a'], orb['b'], orb['giro'])
    ea = sat['escala_atras']
    out = []
    for i in range(sat['n']):
        t = parametro(e, sat['fase'] + i / sat['n'], orb['reparto'])
        # tamaño por profundidad; `fase_escala` corre el punto más grande por la órbita (grados)
        s = math.sin(t - math.radians(sat.get('fase_escala', 0)))
        out.append({'i': i, 't': t, 'c': e.punto(t), 'escala': ea + (1 - ea) * (s + 1) / 2})
    return out


def gema(c: Punto, escala: float, g: dict, colores: tuple) -> str:
    """Gema en cúpula apoyada en el anillo: base elíptica, cúpula redondeada, cara clara y un brillo."""
    oscuro, medio, luz = colores
    w, h, base = g['ancho'] / 2 * escala, g['alto'] * escala, g['base'] * escala
    x, y = c

    def domo(dx, dy, rx, ry, rb):
        cupula, fondo = Elipse((x + dx, y + dy), rx, ry), Elipse((x + dx, y + dy), rx, rb)
        return f'M{pt(cupula.punto(math.pi))} {cupula.arco(math.pi, 2 * math.pi)} {fondo.arco(0, math.pi)} Z'

    return (forma(domo(0, 0, w, h, base), oscuro)
            + forma(domo(-0.06 * w, -0.08 * h, w * 0.9, h * 0.88, base * 0.4), medio)
            + forma(Elipse((x - 0.32 * w, y - 0.58 * h), 0.22 * w, 0.15 * w, -30).path(), luz))


def pieza(sat: dict, c: Punto, escala: float, variante: int = 0) -> str:
    if sat['tipo'] == 'moneda':
        return moneda(c, escala, sat)
    if sat['tipo'] == 'gema':
        return gema(c, escala, sat, sat['colores'][variante % len(sat['colores'])])
    raise ValueError(f'satélite desconocido: {sat["tipo"]}')


def banda(orb: dict, b: dict) -> str:
    """Anillo ancho y plano: corona elíptica (borde exterior e interior) con su canto oscuro debajo."""
    def corona(dy):
        ex = Elipse((b['exterior']['c'][0], b['exterior']['c'][1] + dy), b['exterior']['a'], b['exterior']['b'],
                    orb['giro'])
        en = Elipse((b['interior']['c'][0], b['interior']['c'][1] + dy), b['interior']['a'], b['interior']['b'],
                    orb['giro'])
        return f'{ex.path()} {en.path()}'

    return (f'<path d="{corona(b["canto"])}" fill="{b["color_canto"]}" fill-rule="evenodd"/>'
            f'<path d="{corona(0)}" fill="{b["color"]}" fill-rule="evenodd"/>')


def disco_planeta(p: dict) -> str:
    out = circulo(p['c'], p['r'], p['color_sombra'])
    out += forma(lente((p['c'], p['r']), (p['luz']['c'], p['luz']['r'])), p['color_luz'])
    for b in p.get('brillos', []):
        out += forma(Elipse(b['c'], b['rx'], b['ry'], b.get('giro', 0)).path(), p['color_brillo'])
    return out


def tapa(p: dict, orb: dict) -> str:
    g = math.radians(orb['giro'])
    atras = en_semiplano(orb['c'], (-math.sin(g), math.cos(g)))
    circ = muestrear(Elipse(p['c'], p['r'], p['r']))
    disco = recortar(circ, atras)
    # La luz se pasa 3 px del eje hacia adelante: si los dos bordes coincidieran, el antialias dejaría una línea
    # oscura sobre el lado iluminado.
    luz = recortar_poligono(recortar(circ, lambda q: atras(q) - 3),
                            muestrear(Elipse(p['luz']['c'], p['luz']['r'], p['luz']['r'])))
    partes = [forma(poligono(disco), p['color_sombra']), forma(poligono(luz), p['color_luz'])]
    for b in p.get('brillos', []):
        r = recortar(muestrear(Elipse(b['c'], b['rx'], b['ry'], b.get('giro', 0)), 180), atras)
        if r:
            partes.append(forma(poligono(r), p['color_brillo']))
    for pol, color in p.get('extras_tapa', []):
        r = recortar(pol, atras)
        if r:
            partes.append(forma(poligono(r), color))
    return ''.join(partes)


def construir(cfg: dict) -> Path:
    nombre, o = cfg['nombre'], cfg['origen']
    pl = desplazado(cfg['planeta'], o)
    orb = desplazado(cfg.get('orbita'), o)
    sat = cfg.get('satelites')
    extras = cfg.get('extras', lambda p: '')
    planeta_svg = f'<g id="planeta">{disco_planeta(pl)}</g>'
    if cfg.get('extras'):
        # Formas propias encima del disco (pepitas, oro derretido...): grupo aparte para animarlas solas.
        planeta_svg += f'<g id="planeta-extras">{extras(pl)}</g>'
    if orb and cfg.get('desfile'):
        # Desfile: las piezas avanzan por un arco de la órbita, siempre delante del planeta. Nacen pequeñas en
        # t0, crecen al acercarse y se desvanecen al final (sin pasar por detrás: no hace falta tapa).
        df = cfg['desfile']
        e = Elipse(orb['c'], orb['a'], orb['b'], orb['giro'])
        piezas = []
        for k in range(1, df['n']):  # la 0 está naciendo (tamaño 0) en el primer fotograma
            t = math.radians(df['t0'] + df['paso'] * k)
            r = df['r_media'] + df['r_onda'] * math.sin(t - math.radians(df['fase_r']))
            piezas.append(f'<g id="desfile-{k:02d}">{pieza(sat, e.punto(t), r / df["r_max"], k)}</g>')
        cuerpo = planeta_svg + '<g id="desfile">' + ''.join(piezas) + '</g>'
    elif orb:
        fijo = ''
        if 'linea_orbita' in cfg:
            lo = cfg['linea_orbita']
            lo = desplazado(lo, o)  # puede traer su propia elipse (c, a, b), paralela a la órbita
            e = Elipse(lo.get('c', orb['c']), lo.get('a', orb['a']), lo.get('b', orb['b']), orb['giro'])
            fijo = (f'<path d="{e.path()}" fill="none" '
                    f'stroke="{lo["color"]}" stroke-width="{lo["ancho"]}" stroke-linecap="round"/>')
        if 'banda' in cfg:
            fijo += banda(orb, desplazado(cfg['banda'], o))
        ss = sorted(satelites(orb, sat), key=lambda x: (x['t'] - CORTE) % (2 * math.pi)) if sat else []

        def anillo(n):
            return (f'<g id="{n}"><g id="{n}-fijo">{fijo}</g>'
                    + ''.join(f'<g id="{n}-{x["i"]:02d}">{pieza(sat, x["c"], x["escala"], x["i"])}</g>' for x in ss)
                    + '</g>')

        cuerpo = (anillo('anillo-atras') + planeta_svg + anillo('anillo-frente')
                  + f'<g id="planeta-tapa">{tapa(pl, orb)}</g>')
    else:
        cuerpo = planeta_svg
    d = RAIZ / 'assets/brand/mundos' / nombre
    d.mkdir(parents=True, exist_ok=True)
    out = d / f'{nombre}.svg'
    out.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LADO} {LADO}" '
                   f'width="{LADO}" height="{LADO}">{cuerpo}</svg>\n')
    if sat:
        # Un satélite solo, centrado en (0, 0) a escala 1: la animación lo mueve por la órbita.
        variantes = len(sat.get('colores', [None]))
        grupos = ''.join(f'<g id="satelite-{k}">{pieza(sat, (0.0, 0.0), 1.0, k)}</g>' for k in range(variantes))
        (d / f'{nombre}-satelite.svg').write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">{grupos}</svg>\n')
    params = {'origen': o, 'lado': LADO, 'planeta': {k: v for k, v in pl.items() if k != 'extras_tapa'},
              'orbita': orb, 'satelites': sat, 'desfile': cfg.get('desfile'), 'animacion': cfg.get('animacion', {}),
              'anima_extras': cfg.get('anima_extras', {})}
    (d / f'{nombre}.json').write_text(json.dumps(params, indent=2, ensure_ascii=False))
    print(out)
    return out
