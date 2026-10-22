"""Retoques: correcciones directas sobre el SVG ya vectorizado, como las haría una persona en un editor.

Un defecto puntual (un ojo mal cerrado, una línea que falta, una mota) se arregla más rápido y mejor
dibujando un círculo o una raya que peleando con el motor. El motor queda para los defectos sistemáticos
(los que se repiten en varios personajes).

Los retoques van en el JSON del personaje (`"retoques": [...]`) y se aplican en orden sobre el SVG final.
Coordenadas en px del recorte (las mismas del viewBox; la hoja de `vectorizar.revisar` trae la rejilla).
La salida sigue el contrato animable: solo path/circle/ellipse, sin transform, trazos con puntas redondas.

Operaciones (todas aceptan `grupo` = id del <g> donde van, por defecto `cuerpo`, y `pos` = "encima"
(al final del grupo, por defecto) o "debajo" (al principio)):
  {"op": "circulo", "cx", "cy", "r", "color"}
  {"op": "elipse", "cx", "cy", "rx", "ry", "giro": grados, "color"}
  {"op": "raya", "puntos": [[x, y], ...], "ancho", "color", "suave": true}      trazo abierto, puntas redondas
  {"op": "forma", "puntos": [[x, y], ...], "color", "suave": true}               relleno cerrado
  {"op": "borrar", "zona": [x0, y0, x1, y1], "colores": ["#HEX", ...]}          quita subtrazados/primitivas
                                                                                 enteros dentro de la zona
  {"op": "recolor", "de": "#HEX", "a": "#HEX", "zona": [x0, y0, x1, y1]}         (zona opcional)
  {"op": "ojo", "lado": "izq"|"der", "cx", "cy", "rx", "ry", "giro",
       "esclera": "#FFFFFF", "aro": {"color", "ancho"},
       "iris": {"r", "dx", "dy", "color"}, "pupila": {"r", "color"},
       "brillos": [{"r", "dx", "dy", "color"}],                                   dx/dy relativos al iris
       "parpado": {"color", "ancho", "desde": -170, "hasta": -10},              arco sobre la esclera (grados)
       "pestanas": [{"angulo", "largo", "ancho", "color"}]}
     reemplaza el grupo ojo-<lado> entero (mantiene data-centro/data-radio para Lottie).
  {"op": "grupo_de", "svg": "assets/brand/<p>/<p>-frente.svg", "id": "cabeza", "despues": "cuerpo"}
     copia un <g id> (con sus grupos anidados) de otro SVG de la misma viewBox; reemplaza el homónimo o lo
     inserta después de `despues`. Para prendas: la cabeza del traje en la sudadera, idéntica.
  {"op": "copiar_de", "svg", "de": "cuerpo", "colores": [...], "zona", "escala": 1.17, "mover": [dx, dy],
       "grupo", "pos"}
     copia piezas (subtrazados enteros en la zona) de otro SVG, escaladas y movidas: p. ej. la ballena del traje.
  {"op": "subir", "grupo", "zona", "colores": [...]}
     trae al frente del grupo los subtrazados de esos colores enteros en la zona (la mano sobre la llave copiada).

Pulido lógico (pulido.py): "trazo", "silueta", "elipse_de", "aplanar" rehacen una pieza existente con la forma
que le corresponde (línea de grosor parejo, contorno continuo, elipse exacta, zona de un solo tono).
"""
import math
import re

import numpy as np


def f(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


def _hex(c):
    c = c if c.startswith('#') else '#' + c
    return c.upper()


# ------------------------------------------------------------------------------------------- geometría
def _catmull(pts, cerrado):
    """Puntos -> curva Bézier suave que pasa por todos (Catmull-Rom centrípeta simplificada)."""
    P = [tuple(map(float, p)) for p in pts]
    n = len(P)
    if n < 3:
        return f'M{f(P[0][0])} {f(P[0][1])}' + ''.join(f'L{f(x)} {f(y)}' for x, y in P[1:]) + ('Z' if cerrado else '')
    d = [f'M{f(P[0][0])} {f(P[0][1])}']
    rango = range(n) if cerrado else range(n - 1)
    for i in rango:
        p0 = P[i - 1] if (i > 0 or cerrado) else P[i]
        p1, p2 = P[i], P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (i + 2 < n or cerrado) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}')
    return ''.join(d) + ('Z' if cerrado else '')


def _elipse_d(cx, cy, rx, ry, giro=0.0):
    k = 0.5522847498
    t = math.radians(giro)
    ca, sa = math.cos(t), math.sin(t)
    P = lambda x, y: (cx + x * ca - y * sa, cy + x * sa + y * ca)
    pts = [(rx, 0), (0, ry), (-rx, 0), (0, -ry)]
    ctl = [((rx, k * ry), (k * rx, ry)), ((-k * rx, ry), (-rx, k * ry)),
           ((-rx, -k * ry), (-k * rx, -ry)), ((k * rx, -ry), (rx, -k * ry))]
    q = lambda p: f'{f(p[0])} {f(p[1])}'
    d = [f'M{q(P(*pts[0]))}']
    for i in range(4):
        (a1, a2), e = ctl[i], pts[(i + 1) % 4]
        d.append(f'C{q(P(*a1))} {q(P(*a2))} {q(P(*e))}')
    return ''.join(d) + 'Z'


def _prim(cx, cy, rx, ry, color, giro=0.0, extra=''):
    if abs(rx - ry) < 1e-6:
        return f'<circle{extra} cx="{f(cx)}" cy="{f(cy)}" r="{f(rx)}" fill="{_hex(color)}"/>'
    if abs(giro % 180) < 1e-6:
        return f'<ellipse{extra} cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{_hex(color)}"/>'
    return f'<path{extra} d="{_elipse_d(cx, cy, rx, ry, giro)}" fill="{_hex(color)}"/>'


def _dentro_elipse(x, y, cx, cy, rx, ry, giro):
    t = math.radians(-giro)
    dx, dy = x - cx, y - cy
    u, v = dx * math.cos(t) - dy * math.sin(t), dx * math.sin(t) + dy * math.cos(t)
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1.0 + 1e-9


def _circulo_en_elipse(icx, icy, ir, cx, cy, rx, ry, giro, color):
    """Iris recortado por la esclera (sin clipPath): polígono de la intersección -> curva suave."""
    ts = np.linspace(0, 2 * np.pi, 180, endpoint=False)
    circ = [(icx + ir * math.cos(t), icy + ir * math.sin(t)) for t in ts]
    if all(_dentro_elipse(x, y, cx, cy, rx, ry, giro) for x, y in circ):
        return _prim(icx, icy, ir, ir, color)
    g = math.radians(giro)
    elip = [(cx + rx * math.cos(t) * math.cos(g) - ry * math.sin(t) * math.sin(g),
             cy + rx * math.cos(t) * math.sin(g) + ry * math.sin(t) * math.cos(g)) for t in ts]
    pts = [p for p in circ if _dentro_elipse(*p, cx, cy, rx, ry, giro)]
    pts += [p for p in elip if (p[0] - icx) ** 2 + (p[1] - icy) ** 2 <= ir * ir]
    if len(pts) < 3:
        return ''
    mx, my = np.mean([p[0] for p in pts]), np.mean([p[1] for p in pts])
    pts.sort(key=lambda p: math.atan2(p[1] - my, p[0] - mx))
    # la intersección de dos convexos es convexa: polígono denso con L (fiel en los picos donde se cortan)
    d = f'M{f(pts[0][0])} {f(pts[0][1])}' + ''.join(f'L{f(x)} {f(y)}' for x, y in pts[1::3]) + 'Z'
    return f'<path d="{d}" fill="{_hex(color)}"/>'


def _arco(cx, cy, rx, ry, giro, desde, hasta, n=9):
    g = math.radians(giro)
    out = []
    for t in np.linspace(math.radians(desde), math.radians(hasta), n):
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cx + x * math.cos(g) - y * math.sin(g), cy + x * math.sin(g) + y * math.cos(g)))
    return out


def ojo_svg(o):
    cx, cy, rx, ry = o['cx'], o['cy'], o['rx'], o.get('ry', o['rx'])
    giro = o.get('giro', 0.0)
    out = []
    aro = o.get('aro')
    if aro:
        a = aro.get('ancho', 1.5)
        out.append(_prim(cx, cy, rx + a, ry + a, aro['color'], giro))
    out.append(_prim(cx, cy, rx, ry, o.get('esclera', '#FFFFFF'), giro))
    ir = o.get('iris')
    if ir:
        icx, icy = cx + ir.get('dx', 0), cy + ir.get('dy', 0)
        out.append(_circulo_en_elipse(icx, icy, ir['r'], cx, cy, rx, ry, giro, ir['color']))
        pu = o.get('pupila')
        if pu:
            out.append(_circulo_en_elipse(icx + pu.get('dx', 0), icy + pu.get('dy', 0), pu['r'], cx, cy, rx, ry, giro,
                                          pu['color']))
        for b in o.get('brillos', []):
            out.append(_prim(icx + b.get('dx', 0), icy + b.get('dy', 0), b['r'], b.get('ry', b['r']),
                             b.get('color', '#FFFFFF')))
    pa = o.get('parpado')
    if pa:
        w = pa.get('ancho', 3)
        pts = _arco(cx, cy, rx + w * 0.25, ry + w * 0.25, giro, pa.get('desde', -170), pa.get('hasta', -10))
        out.append(f'<path d="{_catmull(pts, False)}" fill="none" stroke="{_hex(pa["color"])}" '
                   f'stroke-width="{f(w)}" stroke-linecap="round" stroke-linejoin="round"/>')
    for p in o.get('pestanas', []):
        t = math.radians(p['angulo'])
        x0, y0 = cx + (rx + 1) * math.cos(t), cy + (ry + 1) * math.sin(t)
        x1, y1 = x0 + p['largo'] * math.cos(t), y0 + p['largo'] * math.sin(t)
        out.append(f'<path d="M{f(x0)} {f(y0)}L{f(x1)} {f(y1)}" fill="none" stroke="{_hex(p["color"])}" '
                   f'stroke-width="{f(p.get("ancho", 2))}" stroke-linecap="round"/>')
    return ''.join(out)


# ------------------------------------------------------------------------------------------- SVG
def _grupo(svg, gid):
    """(inicio_tag, fin_tag_apertura, inicio_cierre, fin_cierre) del <g id="gid">."""
    m = re.search(rf'<g id="{re.escape(gid)}"[^>]*>', svg)
    if not m:
        raise ValueError(f'retoque: no existe <g id="{gid}">')
    depth = 0
    for t in re.finditer(r'<g\b[^>]*?(/?)>|</g>', svg[m.start():]):
        if t.group(0) == '</g>':
            depth -= 1
        elif not t.group(1):
            depth += 1
        if depth == 0:
            a = m.start() + t.start()
            return m.start(), m.end(), a, a + 4
    raise ValueError(f'retoque: grupo sin cerrar {gid}')


def _insertar(svg, gid, frag, pos='encima'):
    s, e, c, _ = _grupo(svg, gid)
    return svg[:e] + frag + svg[e:] if pos == 'debajo' else svg[:c] + frag + svg[c:]


def _bbox_d(sub):
    nums = [float(x) for x in re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', sub)]
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def _en(z, b):
    return b[0] >= z[0] and b[1] >= z[1] and b[2] <= z[2] and b[3] <= z[3]


def _borrar(frag, zona, colores=None):
    cols = {_hex(c) for c in colores} if colores else None

    def color_ok(tag):
        m = re.search(r'\sfill="([^"]+)"', tag)
        s = re.search(r'\sstroke="([^"]+)"', tag)
        vals = {v.group(1).upper() for v in (m, s) if v}
        return cols is None or bool(vals & cols)

    def path(m):
        tag = m.group(0)
        if not color_ok(tag):
            return tag
        d = re.search(r'\sd="([^"]*)"', tag).group(1)
        subs = [s for s in re.split(r'(?=M)', d) if s.strip()]
        quedan = [s for s in subs if not _en(zona, _bbox_d(s))]
        if len(quedan) == len(subs):
            return tag
        if not quedan:
            return ''
        return tag.replace(f'd="{d}"', f'd="{"".join(quedan)}"')

    def prim(m):
        tag = m.group(0)
        if not color_ok(tag):
            return tag
        g = lambda k: float(re.search(rf'\s{k}="([^"]+)"', tag).group(1))
        cx, cy = g('cx'), g('cy')
        rx = g('r') if m.group(1) == 'circle' else g('rx')
        ry = g('r') if m.group(1) == 'circle' else g('ry')
        return '' if _en(zona, (cx - rx, cy - ry, cx + rx, cy + ry)) else tag

    frag = re.sub(r'<path\b[^>]*>', path, frag)
    return re.sub(r'<(circle|ellipse)\b[^>]*>', prim, frag)


def _grupo_de(svg, r):
    """Copia el <g id> de otro SVG (misma viewBox): p. ej. la cabeza del traje en la sudadera, para que la
    cara no cambie al cambiar de ropa. Reemplaza el grupo homónimo (y los <g id> anidados que traiga, p. ej.
    ojo-izq/ojo-der) o, si no existe, lo inserta después del grupo `despues`."""
    from .pipeline import RAIZ
    otro = (RAIZ / r['svg']).read_text()
    suelto = re.compile(rf'<(?:ellipse|circle|path) id="{re.escape(r["id"])}"[^>]*/>')
    m = suelto.search(otro)
    if m:  # pieza suelta con id (sombra-piso)
        return suelto.sub(lambda _: m.group(0), svg, count=1)
    s, _, _, fin = _grupo(otro, r['id'])
    frag = otro[s:fin]
    for gid in re.findall(r'<g id="([^"]+)"', frag)[1:]:
        try:
            a, _, _, b = _grupo(svg, gid)
            svg = svg[:a] + svg[b:]
        except ValueError:
            pass
    try:
        a, _, _, b = _grupo(svg, r['id'])
        return svg[:a] + frag + svg[b:]
    except ValueError:
        _, _, _, b = _grupo(svg, r.get('despues', 'cuerpo'))
        return svg[:b] + frag + svg[b:]


def _copiar_de(svg, r):
    """Copia de otro SVG las piezas de `colores` (relleno o trazo) cuyos subtrazados caben enteros en `zona`
    (grupo `de`), en su orden, escaladas por `escala` y movidas `mover` [dx, dy] (x' = x·escala + dx), al grupo
    `grupo`. Sin transform: reescribe las coordenadas (contrato: solo M L C Q Z absolutos)."""
    from .pipeline import RAIZ
    otro = (RAIZ / r['svg']).read_text()
    _, e, c, _ = _grupo(otro, r.get('de', 'cuerpo'))
    k, (dx, dy) = r.get('escala', 1.0), r.get('mover', [0, 0])
    cols = {_hex(x) for x in r['colores']}
    zona = r['zona']
    num = r'(-?\d*\.?\d+(?:e-?\d+)?)'

    def mover(sub):
        return re.sub(num + r'[\s,]*' + num,
                      lambda m: f'{f(float(m.group(1)) * k + dx)} {f(float(m.group(2)) * k + dy)}', sub)

    frag = ''
    for m in re.finditer(r'<(path|circle|ellipse)\b[^>]*>', otro[e:c]):
        t = m.group(0)
        vals = {v.upper() for v in re.findall(r'\s(?:fill|stroke)="(#[0-9A-Fa-f]{6})"', t)}
        if not vals & cols:
            continue
        if m.group(1) == 'path':
            d = re.search(r'\sd="([^"]*)"', t).group(1)
            subs = [mover(x) for x in re.split(r'(?=M)', d) if x.strip() and _en(zona, _bbox_d(x))]
            if not subs:
                continue
            t = t.replace(f'd="{d}"', f'd="{"".join(subs)}"')
            t = re.sub(r'stroke-width="([^"]+)"', lambda w: f'stroke-width="{f(float(w.group(1)) * k)}"', t)
            frag += t
        else:
            g = lambda a: float(re.search(rf'\s{a}="([^"]+)"', t).group(1))
            cx, cy = g('cx'), g('cy')
            rx = g('r') if m.group(1) == 'circle' else g('rx')
            ry = g('r') if m.group(1) == 'circle' else g('ry')
            if _en(zona, (cx - rx, cy - ry, cx + rx, cy + ry)):
                col = re.search(r'\sfill="([^"]+)"', t).group(1)
                frag += _prim(cx * k + dx, cy * k + dy, rx * k, ry * k, col)
    return _insertar(svg, r.get('grupo', 'cuerpo'), frag, r.get('pos', 'encima'))


def _subir(svg, r):
    """Trae al frente del grupo los subtrazados de `colores` que caben enteros en `zona` (p. ej. la mano encima
    de una llave copiada), conservando su orden."""
    gid = r.get('grupo', 'cuerpo')
    _, e, c, _ = _grupo(svg, gid)
    cols = {_hex(x) for x in r['colores']}
    frag, arriba = svg[e:c], []

    def path(m):
        tag = m.group(0)
        vals = {v.upper() for v in re.findall(r'\s(?:fill|stroke)="(#[0-9A-Fa-f]{6})"', tag)}
        if not vals & cols:
            return tag
        d = re.search(r'\sd="([^"]*)"', tag).group(1)
        subs = [s for s in re.split(r'(?=M)', d) if s.strip()]
        dentro = [s for s in subs if _en(r['zona'], _bbox_d(s))]
        if not dentro:
            return tag
        arriba.append(tag.replace(f'd="{d}"', f'd="{"".join(dentro)}"'))
        quedan = [s for s in subs if s not in dentro]
        return tag.replace(f'd="{d}"', f'd="{"".join(quedan)}"') if quedan else ''

    frag = re.sub(r'<path\b[^>]*>', path, frag)
    return svg[:e] + frag + ''.join(arriba) + svg[c:]


def aplicar(svg, retoques, log=print):
    for i, r in enumerate(retoques or []):
        op = r['op']
        gid = r.get('grupo', 'cuerpo')
        pos = r.get('pos', 'encima')
        if op == 'circulo':
            svg = _insertar(svg, gid, _prim(r['cx'], r['cy'], r['r'], r['r'], r['color']), pos)
        elif op == 'elipse':
            svg = _insertar(svg, gid, _prim(r['cx'], r['cy'], r['rx'], r['ry'], r['color'], r.get('giro', 0)), pos)
        elif op == 'raya':
            d = _catmull(r['puntos'], False) if r.get('suave', True) else \
                'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in r['puntos'])
            svg = _insertar(svg, gid, f'<path d="{d}" fill="none" stroke="{_hex(r["color"])}" '
                                      f'stroke-width="{f(r.get("ancho", 3))}" stroke-linecap="round" '
                                      f'stroke-linejoin="round"/>', pos)
        elif op == 'forma':
            d = _catmull(r['puntos'], True) if r.get('suave', True) else \
                'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in r['puntos']) + 'Z'
            svg = _insertar(svg, gid, f'<path d="{d}" fill="{_hex(r["color"])}"/>', pos)
        elif op == 'borrar':
            if r.get('grupo'):
                s, e, c, _ = _grupo(svg, gid)
                svg = svg[:e] + _borrar(svg[e:c], r['zona'], r.get('colores')) + svg[c:]
            else:
                svg = _borrar(svg, r['zona'], r.get('colores'))
        elif op == 'recolor':
            de, a = _hex(r['de']), _hex(r['a'])
            if r.get('zona'):
                z = r['zona']

                def rc(m):
                    tag = m.group(0)
                    d = re.search(r'\sd="([^"]*)"', tag)
                    if d:
                        b = _bbox_d(d.group(1))
                    else:
                        g = lambda k: float(re.search(rf'\s{k}="([^"]+)"', tag).group(1))
                        rr = g('r') if ' r="' in tag else max(g('rx'), g('ry'))
                        b = (g('cx') - rr, g('cy') - rr, g('cx') + rr, g('cy') + rr)
                    return re.sub(rf'"{de}"', f'"{a}"', tag, flags=re.I) if _en(z, b) else tag
                svg = re.sub(r'<(path|circle|ellipse)\b[^>]*>', rc, svg)
            else:
                svg = re.sub(rf'"{de}"', f'"{a}"', svg, flags=re.I)
        elif op == 'grupo_de':
            svg = _grupo_de(svg, r)
        elif op == 'copiar_de':
            svg = _copiar_de(svg, r)
        elif op == 'subir':
            svg = _subir(svg, r)
        elif op == 'ojo':
            gid = f'ojo-{r["lado"]}'
            radio = max(r['rx'], r.get('ry', r['rx'])) + (r.get('aro') or {}).get('ancho', 0)
            tag = (f'<g id="{gid}" class="ojo" data-centro="{f(r["cx"])} {f(r["cy"])}" data-radio="{f(radio)}">'
                   + ojo_svg(r) + '</g>')
            try:
                s, _, _, fin = _grupo(svg, gid)
                svg = svg[:s] + tag + svg[fin:]
            except ValueError:
                svg = _insertar(svg, r.get('grupo', 'cabeza'), tag)
        else:
            from . import pulido
            if op not in pulido.OPS:
                raise ValueError(f'retoque {i}: operación desconocida {op}')
            svg = pulido.aplicar_op(svg, r, log)
        log(f'retoque {i + 1}: {op}' + (f' ({r["nota"]})' if r.get('nota') else ''))
    return svg
