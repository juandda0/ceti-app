"""Precisión % (v1, CONGELADA tras la ronda 0): puntuación única del vectorizador sobre el banco de retos.

Precisión = 100 · G · (0.30 C + 0.25 F + 0.20 D + 0.15 L + 0.10 E)     (0–100, más alto es mejor)

  C color     % de píxeles de RELLENO de la figura (máscara de referencia ∪ máscara del render) con
              ΔE2000 < 10, tomando el mínimo ΔE en la vecindad 3×3 de la referencia (1 px de tolerancia).
              La zona de contorno de la referencia NO cuenta en C cuando el caso declara `linea.recolor`
              (bocetos con contorno marrón: el recolor marrón -> tono oscuro del dueño es intencional).
  F forma     F-score de los mapas de bordes entre colores (gradiente Lab + supresión de no-máximos),
              tolerancia 1.5 px. Mide la geometría de rellenos Y de líneas (cada línea aporta sus dos
              bordes: posición y grosor), sin mirar su color.
  D detalle   media por caja de detalle de 0.5·max(0, 1 − ΔEmedio/20) + 0.5·F_caja (mismas reglas).
  L limpieza  1 / (1 + rendijas/(0.0005·Área_fig) + motas/5). Rendijas: píxeles del render (a 2×) con
              el color exacto del fondo (ΔE76 < 2.5) donde la referencia es figura que contrasta con el
              fondo (ΔE76 > 15) en toda la vecindad 5×5, dentro de la silueta del render (huecos < 100 px a 1×). Motas: islas de 1–12 px
              (a 1×) rodeadas por una sola región, con ΔE > 10 respecto a la referencia y fuera de la zona
              de contorno recoloreado, + paths de área < 4 px².
  E eficiencia 0.7·min(1, P_nodos/nodos) + 0.3·min(1, P_kb/kb)  (presupuestos en banco/casos.json).
  G compuertas (si falla una, G = 0): contrato SVG (solo svg/g/path/circle/ellipse; sin transform,
              image, data:, url(), filtros, máscaras ni clip; d solo con M L C Q Z absolutos; pintura
              #RRGGBB explícita en cada forma; trazos con stroke-linecap="round"), ids requeridos
              (ojos con ≥1 círculo/elipse, sombra-piso elipse, cabeza con data-pivote), lib.mjs lo
              parsea con node (svgReader + svgToGroups sin NaN ni formas vacías), nodos ≤ 3× presupuesto
              y paths ≤ 400.
Global = media de los casos; también se reporta el peor caso. Se informa `precision_sin_G` solo como
diagnóstico (p. ej. vtracer usa transform y falla el contrato).

Uso (desde scripts/marca, con el paquete que esté en PYTHONPATH: sirve igual para copias):
  python -m vectorizar.puntaje --todos [--casos R1,S2] [--salida DIR] [--json res.json] [--png DIR]
  python -m vectorizar.puntaje --svg-dir DIR [--etiqueta base] [--json res.json] [--png DIR]
  python -m vectorizar.puntaje --vtracer DIR       # línea base vtracer por defecto en DIR/<id>.svg
  python -m vectorizar.puntaje --antitrampa        # raster incrustado / miles de paths -> < 20
  python -m vectorizar.puntaje --vista DIR         # vistas previas de cajas y zonas de línea
"""
import argparse
import io
import json
import math
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import cairosvg
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage.color import deltaE_ciede2000, rgb2lab

AQUI = Path(__file__).resolve().parent
BANCO = AQUI / 'banco'
RAIZ = Path(os.environ.get('VECTORIZAR_RAIZ', AQUI.parents[2]))
VERSION = 'v1'  # CONGELADA tras la ronda 0 (2026-10-20); cambios solo con aprobación del Director
PESOS = dict(C=0.30, F=0.25, D=0.20, L=0.15, E=0.10)
TOL_BORDE = 1.5
UMBRAL_BORDE = 5.0      # ΔE76 por px (gradiente Sobel/8) para que haya borde
SIGMA_BORDE = 0.8       # suavizado previo (px)
MAX_PATHS = 400


# =============================================================================================== casos
def casos(filtro=None):
    data = json.loads((BANCO / 'casos.json').read_text())
    cs = data['casos']
    if filtro:
        ids = [x.strip() for x in filtro.split(',')]
        cs = [c for c in cs if c['id'] in ids]
    return cs


def _sint():
    import importlib.util
    spec = importlib.util.spec_from_file_location('vectorizar_sinteticos', BANCO / 'sinteticos.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def preparar(caso):
    """Devuelve (src absoluto, box, referencia RGB, zona_linea bool o None) del caso."""
    if caso.get('generador'):
        d = _sint().generar(caso, RAIZ)
        ref = np.asarray(Image.open(d / 'verdad.png').convert('RGB'))
        h, w = ref.shape[:2]
        zona = np.asarray(Image.open(d / 'linea.png')) > 127 if caso['linea'].get('recolor') else None
        return str(d / 'entrada.jpg'), [0, 0, w, h], ref, zona
    src = RAIZ / caso['src']
    ref = np.asarray(Image.open(src).convert('RGB').crop(tuple(caso['box'])))
    return str(src), list(caso['box']), ref, None


def config_de(caso):
    """Config del vectorizador para el caso (personajes/*.json + overrides, partes escaladas)."""
    from .pipeline import DEFECTOS, cargar
    c = caso['config']
    cfg = cargar(c['base']) if c.get('base') else {**DEFECTOS, 'lineas': dict(DEFECTOS['lineas']),
                                                    '_nombre': caso['id']}
    ov = dict(c.get('overrides', {}))
    if 'lineas' in ov:
        cfg['lineas'] = {**cfg['lineas'], **ov.pop('lineas')}
    cfg.update(ov)
    k = c.get('escalar')
    if k:
        partes = {}
        for n, pd in cfg.get('partes', {}).items():
            pd = dict(pd)
            pd['poligono'] = [[x * k, y * k] for x, y in pd['poligono']]
            if pd.get('pivote'):
                pd['pivote'] = [pd['pivote'][0] * k, pd['pivote'][1] * k]
            if pd.get('solapa'):
                pd['solapa'] = max(1, pd['solapa'] * k)
            partes[n] = pd
        cfg['partes'] = partes
        if isinstance(cfg.get('ojos'), dict) and cfg['ojos'].get('zona'):
            cfg['ojos'] = {**cfg['ojos'], 'zona': [v * k for v in cfg['ojos']['zona']]}
    src, box, _, _ = preparar(caso)
    cfg['src'] = src
    cfg['box'] = box
    cfg['_nombre'] = caso['id']
    return cfg


# ============================================================================================ utilidades
def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


def lab76(rgb):
    out = cv2.cvtColor(np.ascontiguousarray(rgb, np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    out[..., 0] *= 100 / 255
    out[..., 1:] -= 128
    return out


def render(svg_text, w, h, fondo, escala=1, crisp=False):
    t = svg_text
    if crisp:
        t = re.sub(r'<svg\b', '<svg shape-rendering="crispEdges"', t, count=1)
    try:
        png = cairosvg.svg2png(bytestring=t.encode(), output_width=w * escala, output_height=h * escala,
                               background_color='#' + fondo)
        return np.asarray(Image.open(io.BytesIO(png)).convert('RGB'))
    except Exception:
        return np.tile(hexrgb(fondo), (h * escala, w * escala, 1))


def figura(rgb, fondo, abrir=True):
    d = np.sqrt(((lab76(rgb) - lab76(hexrgb(fondo)[None, None])[0, 0]) ** 2).sum(-1))
    m = d > 9
    if abrir:
        m = ndi.binary_opening(m, iterations=2)
    return ndi.binary_fill_holes(m)


def de_min3(ref_lab, mine_lab, mask):
    """ΔE2000 mínimo de cada píxel del render (en `mask`) contra la vecindad 3×3 de la referencia."""
    ys, xs = np.nonzero(mask)
    H, W = mask.shape
    m = mine_lab[ys, xs]
    best = np.full(len(ys), np.inf, np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            r = ref_lab[np.clip(ys + dy, 0, H - 1), np.clip(xs + dx, 0, W - 1)]
            best = np.minimum(best, deltaE_ciede2000(r, m).astype(np.float32))
    out = np.full(mask.shape, np.nan, np.float32)
    out[ys, xs] = best
    return out


def bordes(rgb, zona=None):
    """Mapa de bordes entre colores: gradiente en Lab (suavizado) + supresión de no-máximos."""
    L = cv2.GaussianBlur(lab76(rgb), (0, 0), SIGMA_BORDE)
    gx = np.stack([cv2.Sobel(L[..., c], cv2.CV_32F, 1, 0, ksize=3) for c in range(3)], -1) / 8
    gy = np.stack([cv2.Sobel(L[..., c], cv2.CV_32F, 0, 1, ksize=3) for c in range(3)], -1) / 8
    # dirección dominante: la del canal con más energía (aprox. de Di Zenzo)
    mag = np.sqrt((gx ** 2 + gy ** 2).sum(-1))
    sx = (gx * np.sign(gx[..., :1] + 1e-6)).sum(-1)
    sy = (gy * np.sign(gx[..., :1] + 1e-6)).sum(-1)
    ang = (np.rad2deg(np.arctan2(sy, sx)) + 180) % 180
    q = np.zeros(mag.shape, np.int8)
    q[(ang >= 22.5) & (ang < 67.5)] = 1
    q[(ang >= 67.5) & (ang < 112.5)] = 2
    q[(ang >= 112.5) & (ang < 157.5)] = 3
    P = np.pad(mag, 1, mode='edge')
    H, W = mag.shape
    def sh(dy, dx):
        return P[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]
    vec = [(sh(0, 1), sh(0, -1)), (sh(1, 1), sh(-1, -1)), (sh(1, 0), sh(-1, 0)), (sh(1, -1), sh(-1, 1))]
    nms = np.zeros(mag.shape, bool)
    for k, (a, b) in enumerate(vec):
        sel = q == k
        nms |= sel & (mag >= a) & (mag >= b)
    e = nms & (mag > UMBRAL_BORDE)
    if zona is not None:
        e &= zona
    return e


def fscore(e_ref, e_mine, tol=TOL_BORDE):
    if not e_ref.any() and not e_mine.any():
        return 1.0
    if not e_ref.any() or not e_mine.any():
        return 0.0
    d_ref = ndi.distance_transform_edt(~e_ref)
    d_mine = ndi.distance_transform_edt(~e_mine)
    p = float((d_ref[e_mine] <= tol).mean())
    r = float((d_mine[e_ref] <= tol).mean())
    return 0.0 if p + r == 0 else 2 * p * r / (p + r)


def zona_linea_real(ref, caso):
    """Contorno de la referencia (colores de línea del caso, solo estructuras finas) + 1 px de antialias."""
    lc = caso['linea']
    if not lc.get('recolor') or not lc.get('colores'):
        return None
    L = lab76(ref)
    d = np.min([np.sqrt(((L - lab76(hexrgb(c)[None, None])[0, 0]) ** 2).sum(-1)) for c in lc['colores']], 0)
    d = cv2.medianBlur(d.astype(np.float32), 3)
    m = d < lc.get('tol', 12)
    r = int(lc.get('grueso', 6))
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    # regiones anchas del mismo color (piel, cabello) no son contorno: cierre + apertura
    cerrado = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    grueso = cv2.morphologyEx(cerrado, cv2.MORPH_OPEN, disco) > 0
    fino = m & ~ndi.binary_dilation(grueso, iterations=1)
    # una línea es larga y delgada: largo del esqueleto ≥ 20 px y ancho medio (área/largo) ≤ 12 px
    from skimage.morphology import skeletonize
    cc, n = ndi.label(fino, np.ones((3, 3)))
    if n:
        idx = np.arange(1, n + 1)
        area = ndi.sum(fino, cc, idx)
        largo = ndi.sum(skeletonize(fino), cc, idx)
        ok = (largo >= 20) & (area <= 12 * np.maximum(largo, 1))
        fino = np.isin(cc, idx[ok])
    return ndi.binary_dilation(fino, iterations=1)


# ============================================================================================ geometría
_CMD = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)')
_ARIDAD = dict(M=2, L=2, H=1, V=1, C=6, S=4, Q=4, T=2, A=7, Z=0)


def parse_d(d):
    """Path SVG -> (nodos, [subcaminos como polilíneas absolutas], comandos usados)."""
    toks = _CMD.findall(d)
    nodos = 0
    subs, cur = [], None
    x = y = sx = sy = 0.0
    cmd = None
    usados = set()
    nums = []
    i = 0
    seq = []
    for c, n in toks:
        if c:
            seq.append(c)
        else:
            seq.append(float(n))

    def take(k):
        nonlocal i
        v = seq[i:i + k]
        i += k
        return v
    while i < len(seq):
        if isinstance(seq[i], str):
            cmd = seq[i]
            i += 1
            usados.add(cmd)
            if cmd in 'Zz':
                if cur is not None:
                    subs.append(cur)
                    cur = None
                x, y = sx, sy
                continue
        if cmd is None:
            break
        k = _ARIDAD[cmd.upper()]
        if k == 0 or i + k > len(seq) or any(isinstance(v, str) for v in seq[i:i + k]):
            i += 1
            continue
        v = take(k)
        rel = cmd.islower()
        C = cmd.upper()
        nodos += 1
        if C == 'M':
            if cur is not None:
                subs.append(cur)
            x, y = (x + v[0], y + v[1]) if rel else (v[0], v[1])
            sx, sy = x, y
            cur = [(x, y)]
            cmd = 'l' if rel else 'L'
            continue
        if cur is None:
            cur = [(x, y)]
        if C == 'L' or C == 'T':
            x, y = (x + v[0], y + v[1]) if rel else (v[0], v[1])
            cur.append((x, y))
        elif C == 'H':
            x = x + v[0] if rel else v[0]
            cur.append((x, y))
        elif C == 'V':
            y = y + v[0] if rel else v[0]
            cur.append((x, y))
        elif C in 'CSQ':
            pts = [(v[j] + (x if rel else 0), v[j + 1] + (y if rel else 0)) for j in range(0, k, 2)]
            ctrl = [(x, y)] + pts
            if C == 'S':
                ctrl = [(x, y), pts[0], pts[0], pts[1]]
            if C == 'Q':
                ctrl = [(x, y), pts[0], pts[1]]
            for t in np.linspace(0, 1, 9)[1:]:
                cur.append(_bez(ctrl, t))
            x, y = pts[-1]
        elif C == 'A':
            x, y = (x + v[5], y + v[6]) if rel else (v[5], v[6])
            cur.append((x, y))
    if cur is not None:
        subs.append(cur)
    return nodos, subs, usados


def _bez(ctrl, t):
    pts = list(ctrl)
    while len(pts) > 1:
        pts = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(pts, pts[1:])]
    return pts[0]


def area_subs(subs):
    a = 0.0
    for s in subs:
        if len(s) < 3:
            continue
        p = np.array(s)
        a += 0.5 * (p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1]).sum()
    return abs(a)


# ============================================================================================ compuertas
PERMITIDOS = {'svg', 'g', 'path', 'circle', 'ellipse'}
ATTR_PROHIBIDOS = {'transform', 'filter', 'mask', 'clip-path', 'href', 'xlink:href', 'style'}


def _tag(e):
    return e.tag.split('}')[-1]


def contrato(svg_text):
    """Revisa el contrato; devuelve (fallos, info) con nodos, paths, áreas de paths, ids."""
    fallos = []
    info = dict(nodos=0, paths=0, prims=0, areas=[], ids={})
    if 'data:' in svg_text:
        fallos.append('data: incrustado')
    if 'url(' in svg_text:
        fallos.append('url() (degradado/patrón/filtro)')
    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError as e:
        return [f'XML inválido: {e}'], info
    if _tag(root) != 'svg':
        fallos.append('raíz no es <svg>')
    malos = set()
    for e in root.iter():
        t = _tag(e)
        if t not in PERMITIDOS:
            malos.add(t)
            continue
        for a in e.attrib:
            an = a.split('}')[-1]
            if an in ATTR_PROHIBIDOS or a.endswith('}href'):
                malos.add(f'@{an}')
        if e.get('id'):
            info['ids'][e.get('id')] = e
        if t in ('path', 'circle', 'ellipse'):
            f, s = e.get('fill'), e.get('stroke')
            if f is None and s is None:
                malos.add('forma sin fill/stroke propio')
            for v in (f, s):
                if v not in (None, 'none') and not re.fullmatch(r'#[0-9A-Fa-f]{6}', v):
                    malos.add(f'color no #RRGGBB ({v[:12]})')
            if s not in (None, 'none') and e.get('stroke-linecap') != 'round':
                malos.add('trazo sin stroke-linecap="round"')
        if t == 'path':
            info['paths'] += 1
            n, subs, usados = parse_d(e.get('d', ''))
            info['nodos'] += n
            bad = usados - set('MLCQZ')
            if bad:
                malos.add('comandos de path no soportados por lib.mjs: ' + ''.join(sorted(bad)))
            if f not in (None, 'none'):
                info['areas'].append(area_subs(subs))
        elif t in ('circle', 'ellipse'):
            info['prims'] += 1
            info['nodos'] += 4
            try:
                if t == 'circle':
                    r = float(e.get('r'))
                    info['areas'].append(math.pi * r * r)
                else:
                    info['areas'].append(math.pi * float(e.get('rx')) * float(e.get('ry')))
            except (TypeError, ValueError):
                malos.add('primitiva sin radio numérico')
    fallos += sorted(malos)
    return fallos, info


def ids_requeridos(info, ids):
    fallos = []
    for i in ids:
        e = info['ids'].get(i)
        if e is None:
            fallos.append(f'falta id {i}')
            continue
        t = _tag(e)
        if i == 'sombra-piso' and t != 'ellipse':
            fallos.append('sombra-piso no es <ellipse>')
        elif i.startswith('ojo-'):
            if t != 'g' and t not in ('circle', 'ellipse'):
                fallos.append(f'{i} no es grupo/primitiva')
            elif t == 'g' and not any(_tag(x) in ('circle', 'ellipse') for x in e.iter()):
                fallos.append(f'{i} sin círculos/elipses')
        elif i not in ('sombra-piso',) and not i.startswith('ojo-') and t != 'g':
            fallos.append(f'{i} no es <g>')
        if i == 'cabeza' and t == 'g':
            pv = (e.get('data-pivote') or '').split()
            if len(pv) != 2:
                fallos.append('cabeza sin data-pivote="x y"')
    return fallos


_NODE = r"""
import { pathToFileURL } from 'node:url';
const [lib, file, ...ids] = process.argv.slice(1);
const { svgReader, svgToGroups } = await import(pathToFileURL(lib).href);
let bad = 0, vacias = 0, n = 0;
const walk = (v) => {
  if (typeof v === 'number') { if (!Number.isFinite(v)) bad++; }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') for (const k in v) walk(v[k]);
};
const revisa = (gs) => { for (const g of gs) { n++; walk(g); if (!g.it.some((x) => x.ty === 'sh' || x.ty === 'el')) vacias++; } };
try {
  const R = svgReader(file);
  revisa(svgToGroups(R, R.SVG, 'todo'));
  for (const id of ids) revisa(svgToGroups(R, R.stripSubgroups(R.groupInner(id)), id));
  console.log(JSON.stringify({ ok: bad === 0 && vacias === 0, bad, vacias, n }));
} catch (e) { console.log(JSON.stringify({ ok: false, error: String(e.message || e) })); }
"""


def parsea_node(svg_path, gids):
    try:
        r = subprocess.run(['node', '--input-type=module', '-e', _NODE, '--', str(RAIZ / 'scripts/lottie/lib.mjs'),
                            str(svg_path), *gids], capture_output=True, text=True, timeout=120)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:  # noqa: BLE001
        return {'ok': False, 'error': f'node: {e}'}


# ============================================================================================ puntaje
def puntuar(svg_path, caso, ref=None, zona=None, detalle_png=None):
    """Puntúa un SVG contra el caso. Devuelve dict con precision, componentes y compuertas."""
    t0 = time.time()
    if ref is None:
        _, _, ref, zona = preparar(caso)
    svg_path = Path(svg_path)
    svg = svg_path.read_text()
    h, w = ref.shape[:2]
    fondo = caso['fondo']
    pres = caso['presupuesto']

    # ---------------------------------------------------------------- compuertas
    fallos, info = contrato(svg)
    fallos += ids_requeridos(info, caso['ids'])
    gids = [i for i in caso['ids'] if i in info['ids'] and _tag(info['ids'][i]) == 'g']
    nd = parsea_node(svg_path, gids) if not any(f.startswith('XML') for f in fallos) else {'ok': False}
    if not nd.get('ok'):
        fallos.append('lib.mjs no lo parsea' + (f" ({nd.get('error', '')[:80]})" if nd.get('error') else
                                                f" (NaN {nd.get('bad')}, vacías {nd.get('vacias')})"))
    if info['nodos'] > 3 * pres['nodos']:
        fallos.append(f"nodos {info['nodos']} > 3×{pres['nodos']}")
    if info['paths'] > MAX_PATHS:
        fallos.append(f"paths {info['paths']} > {MAX_PATHS}")
    G = 0 if fallos else 1

    # ---------------------------------------------------------------- rasters
    mine = render(svg, w, h, fondo)
    fig_r, fig_m = figura(ref, fondo), figura(mine, fondo)
    U = fig_r | fig_m
    cerca = ndi.binary_dilation(U | figura(mine, fondo, abrir=False), iterations=2)
    ref_l, mine_l = rgb2lab(ref), rgb2lab(mine)
    dE = de_min3(ref_l, mine_l, cerca)
    if zona is None:
        zona = zona_linea_real(ref, caso)
    pinta = U & ~zona if zona is not None else U

    # C color (rellenos)
    C = float((dE[pinta] < 10).mean()) if pinta.any() else 0.0

    # F forma (bordes entre colores, incluye la geometría de las líneas)
    zb = ndi.binary_dilation(U, iterations=3)
    e_r, e_m = bordes(ref, zb), bordes(mine, zb)
    F = fscore(e_r, e_m)

    # D detalle
    dets = {}
    for nombre, (x0, y0, x1, y1) in caso['detalle'].items():
        z = np.zeros((h, w), bool)
        z[y0:y1, x0:x1] = True
        pz = pinta & z
        dem = float(np.nanmean(dE[pz])) if pz.any() else 0.0
        fz = fscore(e_r & z, e_m & z)
        dets[nombre] = dict(dE=round(dem, 2), F=round(fz, 3), D=round(0.5 * max(0, 1 - dem / 20) + 0.5 * fz, 4))
    D = float(np.mean([v['D'] for v in dets.values()])) if dets else 1.0

    # L limpieza
    area = max(1, int(fig_r.sum()))
    m2 = render(svg, w, h, fondo, 2)
    esbg = np.sqrt(((lab76(m2) - lab76(hexrgb(fondo)[None, None])[0, 0]) ** 2).sum(-1)) < 2.5
    # solo cuenta donde la referencia contrasta con el fondo (ΔE76 > 15 en toda la vecindad 5×5): un
    # hueco ahí se ve; un relleno casi del color del fondo (brillos, vidrio, crema) no es rendija
    lejos = np.sqrt(((lab76(ref) - lab76(hexrgb(fondo)[None, None])[0, 0]) ** 2).sum(-1)) > 15
    ref_fig2 = cv2.resize(ndi.binary_erosion(lejos & fig_r, iterations=2).astype(np.uint8), (2 * w, 2 * h),
                          interpolation=cv2.INTER_NEAREST) > 0
    # y dentro de la silueta del propio render (un elemento que falta entero no es rendija: eso lo mide C)
    sil = ndi.binary_fill_holes(~esbg)
    rend = esbg & ref_fig2 & sil
    cc, n = ndi.label(rend)
    rendijas = 0.0
    if n:
        tam = ndi.sum(rend, cc, range(1, n + 1))
        rendijas = float(tam[tam < 400].sum()) / 4       # en px a 1×
    crisp = render(svg, w, h, fondo, 2, crisp=True)
    cod = (crisp[..., 0].astype(np.int32) << 16) | (crisp[..., 1].astype(np.int32) << 8) | crisp[..., 2]
    bg = int(hexrgb(fondo)[0]) << 16 | int(hexrgb(fondo)[1]) << 8 | int(hexrgb(fondo)[2])
    dE2 = cv2.resize(np.nan_to_num(dE, nan=0.0), (2 * w, 2 * h), interpolation=cv2.INTER_NEAREST)
    zona2 = (cv2.resize(zona.astype(np.uint8), (2 * w, 2 * h), interpolation=cv2.INTER_NEAREST) > 0
             if zona is not None else np.zeros((2 * h, 2 * w), bool))
    from skimage.measure import label as etiquetar
    islas = 0
    H2, W2 = cod.shape
    # componentes conexas de igual color en una sola pasada
    lb = etiquetar(np.where(cod == bg, -1, cod), background=-1, connectivity=2)
    tam = np.bincount(lb.ravel())
    # mota = isla de 1–12 px (a 1×) metida en UNA sola región (no una astilla de raster entre dos
    # colores), que no se parece a la referencia (ΔE > 10) y no está en la zona de contorno recoloreado
    chicas = np.where((tam >= 3) & (tam < 48))[0]
    chicas = chicas[chicas > 0]
    if len(chicas):
        idx = lb.ravel()
        sde = np.bincount(idx, weights=dE2.ravel(), minlength=len(tam))
        szo = np.bincount(idx, weights=zona2.ravel().astype(float), minlength=len(tam))
        sl = ndi.find_objects(lb)
        for j in chicas:
            if sde[j] / tam[j] <= 10 or szo[j] / tam[j] > 0.5 or sl[j - 1] is None:
                continue
            ys, xs = sl[j - 1]
            y0, y1, x0, x1 = max(0, ys.start - 1), min(H2, ys.stop + 1), max(0, xs.start - 1), min(W2, xs.stop + 1)
            isla = lb[y0:y1, x0:x1] == j
            anillo = ndi.binary_dilation(isla, np.ones((3, 3))) & ~isla
            v, n_ = np.unique(cod[y0:y1, x0:x1][anillo], return_counts=True)
            if n_.max() >= 0.9 * n_.sum():
                islas += 1
    diminutos = int(sum(1 for a in info['areas'] if a < 4))
    motas = islas + diminutos
    Lc = 1 / (1 + rendijas / (0.0005 * area) + motas / 5)

    # E eficiencia
    kb = len(svg.encode()) / 1024
    E = 0.7 * min(1, pres['nodos'] / max(1, info['nodos'])) + 0.3 * min(1, pres['kb'] / max(0.01, kb))

    base = PESOS['C'] * C + PESOS['F'] * F + PESOS['D'] * D + PESOS['L'] * Lc + PESOS['E'] * E
    out = dict(caso=caso['id'], precision=round(100 * G * base, 2), precision_sin_G=round(100 * base, 2),
               G=G, compuertas=fallos, C=round(C, 4), F=round(F, 4), D=round(D, 4), L=round(Lc, 4),
               E=round(E, 4), detalle=dets, rendijas=round(rendijas, 1), motas=motas, islas=islas,
               paths_diminutos=diminutos, nodos=info['nodos'], paths=info['paths'], primitivas=info['prims'],
               kb=round(kb, 1), svg=str(svg_path), seg=round(time.time() - t0, 1))
    if detalle_png:
        comparativa(ref, mine, caso, detalle_png, out)
    return out


# ============================================================================================ imágenes
def comparativa(ref, mine, caso, png, res=None, zoom=3):
    """Referencia | render completo, y filas con zoom 3× de cada caja de detalle."""
    h, w = ref.shape[:2]
    sep = lambda a: np.full((a, 8, 3), 255, np.uint8)  # noqa: E731
    k = 1 if h <= 900 else 900 / h
    a, b = ref, mine
    if k != 1:
        a = cv2.resize(ref, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
        b = cv2.resize(mine, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    filas = [np.hstack([a, sep(a.shape[0]), b])]
    for nombre, (x0, y0, x1, y1) in caso['detalle'].items():
        za = cv2.resize(ref[y0:y1, x0:x1], None, fx=zoom, fy=zoom, interpolation=cv2.INTER_NEAREST)
        zb = cv2.resize(mine[y0:y1, x0:x1], None, fx=zoom, fy=zoom, interpolation=cv2.INTER_NEAREST)
        filas.append(np.hstack([za, sep(za.shape[0]), zb]))
    W = max(f.shape[1] for f in filas)
    filas = [np.pad(f, ((0, 8), (0, W - f.shape[1]), (0, 0)), constant_values=255) for f in filas]
    img = Image.fromarray(np.vstack(filas))
    if res:
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, 520, 14], fill=(255, 255, 255))
        d.text((2, 1), f"{caso['id']}  P={res['precision']} (sinG {res['precision_sin_G']})  C={res['C']:.2f} "
                       f"F={res['F']:.2f} D={res['D']:.2f} L={res['L']:.2f} E={res['E']:.2f}", fill=(0, 0, 0))
    Path(png).parent.mkdir(parents=True, exist_ok=True)
    img.save(png)


def vista(caso, png):
    """Vista previa del caso: recorte con cajas de detalle (rojo) y zona de línea (azul) para verificarlo."""
    _, _, ref, zona = preparar(caso)
    if zona is None:
        zona = zona_linea_real(ref, caso)
    img = ref.copy()
    if zona is not None:
        img[zona] = (0.5 * img[zona] + 0.5 * np.array([0, 90, 255])).astype(np.uint8)
    im = Image.fromarray(img)
    d = ImageDraw.Draw(im)
    for nombre, (x0, y0, x1, y1) in caso['detalle'].items():
        d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(255, 0, 0), width=2)
        d.text((x0 + 3, y0 + 2), nombre, fill=(255, 0, 0))
    e = bordes(ref, ndi.binary_dilation(figura(ref, caso['fondo']), iterations=3))
    b = np.asarray(im).copy()
    b[e] = (0, 160, 0)
    im = Image.fromarray(np.hstack([np.asarray(im), np.full((ref.shape[0], 8, 3), 255, np.uint8), b]))
    Path(png).parent.mkdir(parents=True, exist_ok=True)
    im.save(png)


# ============================================================================================ corridas
def _correr_uno(args):
    caso, salida = args
    from .pipeline import vectorizar
    t0 = time.time()
    try:
        cfg = config_de(caso)
        svg, _ = vectorizar(cfg, log=lambda *x: None)
        p = Path(salida) / f"{caso['id']}.svg"
        p.write_text(svg)
        return caso['id'], str(p), round(time.time() - t0, 1), None
    except Exception as e:  # noqa: BLE001
        import traceback
        return caso['id'], None, round(time.time() - t0, 1), traceback.format_exc()[-600:]


def correr(cs, salida, paralelo=2):
    from concurrent.futures import ProcessPoolExecutor
    Path(salida).mkdir(parents=True, exist_ok=True)
    out = {}
    with ProcessPoolExecutor(max_workers=paralelo) as ex:
        for cid, p, seg, err in ex.map(_correr_uno, [(c, salida) for c in cs]):
            out[cid] = (p, seg, err)
            print(f'  vectorizado {cid} {seg}s' + (f' ERROR {err}' if err else ''), file=sys.stderr)
    return out


def vtracer_base(cs, salida):
    import vtracer
    Path(salida).mkdir(parents=True, exist_ok=True)
    for c in cs:
        src, box, _, _ = preparar(c)
        img = Image.open(src).convert('RGB').crop(tuple(box))
        b = io.BytesIO()
        img.save(b, format='PNG')
        svg = vtracer.convert_raw_image_to_svg(b.getvalue(), img_format='png')
        (Path(salida) / f"{c['id']}.svg").write_text(svg)
        print(f"  vtracer {c['id']}", file=sys.stderr)


def tabla(res):
    filas = [f"{'caso':<5} {'P%':>6} {'sinG':>6} {'C':>5} {'F':>5} {'D':>5} {'L':>5} {'E':>5} {'nodos':>6} "
             f"{'paths':>5} compuertas"]
    for r in res:
        if r.get('error'):
            filas.append(f"{r['caso']:<5} {'—':>6} ERROR {r['error'][:60]}")
            continue
        filas.append(f"{r['caso']:<5} {r['precision']:6.2f} {r['precision_sin_G']:6.2f} {r['C']:5.3f} {r['F']:5.3f} "
                     f"{r['D']:5.3f} {r['L']:5.3f} {r['E']:5.3f} {r['nodos']:6d} {r['paths']:5d} "
                     f"{'ok' if r['G'] else '; '.join(r['compuertas'])[:90]}")
    return '\n'.join(filas)


def resumen(res):
    ps = [r.get('precision', 0.0) for r in res]
    sg = [r.get('precision_sin_G', 0.0) for r in res]
    peor = min(res, key=lambda r: r.get('precision', 0.0)) if res else None
    return dict(global_=round(float(np.mean(ps)), 2) if ps else 0, peor=round(min(ps), 2) if ps else 0,
                peor_caso=peor['caso'] if peor else None, global_sin_G=round(float(np.mean(sg)), 2) if sg else 0)


def puntuar_dir(cs, d, png_dir=None, etiqueta=''):
    res = []
    for c in cs:
        p = Path(d) / f"{c['id']}.svg"
        if not p.exists():
            res.append(dict(caso=c['id'], precision=0.0, precision_sin_G=0.0, G=0, error='sin SVG'))
            continue
        png = Path(png_dir) / f"{c['id']}-{etiqueta or 'svg'}.png" if png_dir else None
        res.append(puntuar(p, c, detalle_png=png))
        print(f"  puntuado {c['id']} {res[-1]['precision']}", file=sys.stderr)
    return res


# ============================================================================================ antitrampa
def antitrampa(caso_id='R1', d=None):
    """Trampas conocidas deben sacar < 20: raster incrustado, miles de paths diminutos, mosaico ≤400 paths."""
    import base64
    c = [x for x in casos() if x['id'] == caso_id][0]
    _, _, ref, zona = preparar(c)
    h, w = ref.shape[:2]
    d = Path(d or Path.home() / '.cache/vectorizar/antitrampa')
    d.mkdir(parents=True, exist_ok=True)
    # ids requeridos válidos (la trampa solo debe caer por la trampa, no por faltar ids)
    def _id(i):
        if i == 'sombra-piso':
            return f'<ellipse id="sombra-piso" cx="{w / 2}" cy="{h - 20}" rx="{w / 3}" ry="12" fill="#E2BA93"/>'
        if i.startswith('ojo-'):
            return f'<g id="{i}"><circle cx="1" cy="1" r="0.5" fill="#000000"/></g>'
        if i == 'cabeza':
            return f'<g id="cabeza" data-pivote="{w / 2} {h / 4}"></g>'
        return f'<g id="{i}"></g>'
    grupos = ''.join(_id(i) for i in c['ids'])
    b = io.BytesIO()
    Image.fromarray(ref).save(b, format='PNG')
    trampas = {}
    trampas['raster'] = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><image width="{w}" '
                         f'height="{h}" href="data:image/png;base64,{base64.b64encode(b.getvalue()).decode()}"/>'
                         f'{grupos}</svg>')
    # miles de paths diminutos: un cuadrado de 2×2 px por bloque de la figura
    fig = figura(ref, c['fondo'])
    ps = []
    for y in range(0, h - 1, 2):
        for x in range(0, w - 1, 2):
            if fig[y, x]:
                col = ''.join(f'{v:02X}' for v in ref[y, x])
                ps.append(f'<path d="M{x} {y} L{x + 2} {y} L{x + 2} {y + 2} L{x} {y + 2} Z" fill="#{col}"/>')
    trampas['miles_de_paths'] = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
                                 f'<g id="cuerpo">{"".join(ps)}</g>' + grupos.replace('<g id="cuerpo"></g>', '') +
                                 '</svg>')
    # mosaico que respeta ≤400 paths: un path por color cuantizado con miles de subcaminos de 2×2 px
    q = (ref // 24) * 24 + 12
    cods = (q[..., 0].astype(np.int32) << 16) | (q[..., 1].astype(np.int32) << 8) | q[..., 2]
    por = {}
    for y in range(0, h - 1, 2):
        for x in range(0, w - 1, 2):
            if fig[y, x]:
                por.setdefault(int(cods[y, x]), []).append(f'M{x} {y} L{x + 2} {y} L{x + 2} {y + 2} L{x} {y + 2} Z')
    top = sorted(por, key=lambda k: -len(por[k]))[:380]
    ps = [f'<path d="{" ".join(por[k])}" fill="#{k:06X}"/>' for k in top]
    trampas['mosaico_400'] = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
                              f'<g id="cuerpo">{"".join(ps)}</g>' + grupos.replace('<g id="cuerpo"></g>', '') +
                              '</svg>')
    # informativa (no se exige < 20): mosaico de bloques de 16 px que sí cabe en las compuertas
    ps = []
    for y in range(0, h - 15, 16):
        for x in range(0, w - 15, 16):
            if fig[y + 8, x + 8]:
                col = ''.join(f'{v:02X}' for v in ref[y:y + 16, x:x + 16].reshape(-1, 3).mean(0).astype(int))
                ps.append(f'M{x} {y} L{x + 16} {y} L{x + 16} {y + 16} L{x} {y + 16} Z|{col}')
    porc = {}
    for t in ps:
        dd, col = t.split('|')
        porc.setdefault(col, []).append(dd)
    trampas['mosaico_16px_informativa'] = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
                                           f'<g id="cuerpo">' + ''.join(f'<path d="{" ".join(v)}" fill="#{k}"/>'
                                                                         for k, v in list(porc.items())[:390]) +
                                           '</g>' + grupos.replace('<g id="cuerpo"></g>', '') + '</svg>')
    res = {}
    ok = True
    for nombre, svg in trampas.items():
        p = d / f'{caso_id}-{nombre}.svg'
        p.write_text(svg)
        r = puntuar(p, c, ref, zona)
        res[nombre] = dict(precision=r['precision'], precision_sin_G=r['precision_sin_G'], compuertas=r['compuertas'])
        if 'informativa' not in nombre:
            ok &= r['precision'] < 20
        print(f"  trampa {nombre}: {r['precision']} (sin G {r['precision_sin_G']}) {r['compuertas'][:3]}",
              file=sys.stderr)
    return ok, res


# ============================================================================================ CLI
def main():
    ap = argparse.ArgumentParser(prog='vectorizar.puntaje', description=__doc__.split('\n')[0])
    ap.add_argument('--todos', action='store_true', help='vectoriza todos los casos con el paquete actual')
    ap.add_argument('--casos', help='lista de ids (R1,S2,...)')
    ap.add_argument('--salida', help='carpeta de SVG (por defecto ~/.cache/vectorizar/puntaje/<hora>)')
    ap.add_argument('--svg-dir', help='puntuar SVG ya hechos: DIR/<id>.svg')
    ap.add_argument('--vtracer', help='genera la línea base vtracer (por defecto) en esta carpeta y la puntúa')
    ap.add_argument('--etiqueta', default='', help='nombre de la variante (para json y png)')
    ap.add_argument('--json', help='guardar resultados')
    ap.add_argument('--png', help='carpeta para comparativas con zoom 3×')
    ap.add_argument('--paralelo', type=int, default=2)
    ap.add_argument('--antitrampa', action='store_true')
    ap.add_argument('--vista', help='carpeta para vistas previas de los casos')
    a = ap.parse_args()
    cs = casos(a.casos)
    if a.vista:
        for c in cs:
            vista(c, Path(a.vista) / f"{c['id']}-vista.png")
            print(Path(a.vista) / f"{c['id']}-vista.png")
        return 0
    if a.antitrampa:
        ok, res = antitrampa()
        print(json.dumps(res, ensure_ascii=False, indent=1))
        return 0 if ok else 1
    res = None
    etiqueta = a.etiqueta
    if a.todos:
        salida = a.salida or str(Path.home() / '.cache/vectorizar/puntaje' / time.strftime('%Y%m%d-%H%M%S'))
        corr = correr(cs, salida, a.paralelo)
        res = puntuar_dir(cs, salida, a.png, etiqueta or 'v')
        for r in res:
            p, seg, err = corr.get(r['caso'], (None, None, None))
            r['seg_vectorizar'] = seg
            if err:
                r['error'] = err
    elif a.vtracer:
        vtracer_base(cs, a.vtracer)
        res = puntuar_dir(cs, a.vtracer, a.png, etiqueta or 'vtracer')
    elif a.svg_dir:
        res = puntuar_dir(cs, a.svg_dir, a.png, etiqueta or 'svg')
    else:
        ap.print_help()
        return 2
    print(tabla(res))
    s = resumen(res)
    print(f"GLOBAL {s['global_']}  PEOR {s['peor']} ({s['peor_caso']})  global_sin_G {s['global_sin_G']}")
    if a.json:
        Path(a.json).write_text(json.dumps(dict(version=VERSION, etiqueta=etiqueta, resumen=s, casos=res),
                                           ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
