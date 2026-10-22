"""Banco de pruebas: métricas objetivas de un SVG frente a su referencia + comparativas con zoom.

Uso:
  python -m vectorizar.banco <svg> --caso tato [--png comparativa.png] [--json]
Métricas:
  dE_figura     ΔE76 medio (Lab) dentro de la figura, render vs referencia (más bajo = mejor)
  pct_dE10      % de píxeles de la figura con ΔE < 10
  dE_detalle    ΔE medio en las zonas de detalle del caso (cara, manos, accesorios)
  iou_color     IoU medio por clase de color (referencia clasificada vs render clasificado)
  nodos         nº de nodos (vértices de path + primitivas)
  kb            tamaño del archivo
  borde_px      longitud total de bordes entre colores del render (px): rugosidad / ruido
  rendijas      nº de píxeles de fondo que se cuelan dentro de la figura (gaps entre colores)
  espigas       nº de islas de color diminutas (<12 px) en el render (motas, espigas)
"""
import argparse, io, json, os, re, sys
from pathlib import Path
import cairosvg, cv2, numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = Path(os.environ.get('VECTORIZAR_RAIZ', Path(__file__).resolve().parents[3]))
CASOS = {
    'tato': dict(src='assets/brand/bocetos/tato-03-hoja-modelo.jpg', box=(100, 30, 620, 820), fondo='FBEFDB',
                 detalle={'cara': (130, 60, 340, 270), 'mano-izq': (60, 440, 150, 560), 'bolsa': (300, 520, 430, 640),
                          'insignia': (175, 320, 285, 395)}),
    'juan': dict(src='assets/brand/bocetos/juan-02-capitan.jpg', box=(120, 40, 580, 820), fondo='FCEFDB',
                 detalle={'cara': (100, 60, 330, 260), 'reloj-tablet': (230, 400, 400, 540), 'pulsera-mano': (40, 440, 130, 550),
                          'insignia': (160, 315, 270, 390)}),
    'ceti': dict(src='assets/brand/bocetos/ceti-05-hoja-modelo.jpg', box=(96, 150, 736, 770), fondo='F9F3E1',
                 detalle={'ojos': (190, 110, 450, 230), 'boca': (220, 200, 420, 260), 'cola': (200, 500, 440, 600)}),
}


def lab(a):
    return cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32) * [100 / 255, 1, 1] - [0, 128, 128]


def referencia(caso):
    c = CASOS[caso]
    return np.asarray(Image.open(RAIZ / c['src']).convert('RGB').crop(c['box']))


def render(svg_text, w, h, fondo, escala=1):
    png = cairosvg.svg2png(bytestring=svg_text.encode(), output_width=w * escala, output_height=h * escala,
                           background_color='#' + fondo)
    return np.asarray(Image.open(io.BytesIO(png)).convert('RGB'))


def contar_nodos(svg):
    n = 0
    for d in re.findall(r'\sd="([^"]*)"', svg):
        n += len(re.findall(r'[MLCQSTAHV]', d, re.I)) + max(0, len(re.findall(r'C', d)) * 0)
    n += len(re.findall(r'<(circle|ellipse)\b', svg)) * 4
    n += len(re.findall(r'<rect\b', svg)) * 4
    return n


def figura_de(ref, fondo):
    """Figura = lo que no es fondo/piso alcanzable desde el borde."""
    L = lab(ref)
    bg = lab(np.array([[[int(fondo[i:i + 2], 16) for i in (0, 2, 4)]]]))[0, 0]
    d = np.sqrt(((L - bg) ** 2).sum(-1))
    lejos = d > 9
    fig = ndi.binary_fill_holes(ndi.binary_opening(lejos, iterations=2))
    return fig, L


def paleta_ref(L, fig, k=14):
    px = L[fig].reshape(-1, 3)
    rng = np.random.default_rng(0)
    s = px[rng.choice(len(px), min(60000, len(px)), replace=False)]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.2)
    _, _, cen = cv2.kmeans(s.astype(np.float32), k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    return cen


def clasificar(L, cen):
    d = ((L[:, :, None, :] - cen[None, None]) ** 2).sum(-1)
    return d.argmin(-1)


def metricas(svg_path, caso):
    c = CASOS[caso]
    svg = Path(svg_path).read_text()
    ref = referencia(caso)
    h, w = ref.shape[:2]
    mine = render(svg, w, h, c['fondo'])
    fig, Lr = figura_de(ref, c['fondo'])
    Lm = lab(mine)
    dE = np.sqrt(((Lr - Lm) ** 2).sum(-1))
    # la figura del render también cuenta (si el SVG se sale o le falta algo)
    figm, _ = figura_de(mine, c['fondo'])
    union = fig | figm
    out = {'dE_figura': float(dE[union].mean()), 'pct_dE10': float((dE[union] < 10).mean() * 100)}
    dets = {}
    for k, (x0, y0, x1, y1) in c['detalle'].items():
        z = np.zeros_like(fig); z[y0:y1, x0:x1] = True
        dets[k] = float(dE[z & union].mean())
    out['dE_detalle'] = float(np.mean(list(dets.values())))
    out['dE_por_detalle'] = {k: round(v, 2) for k, v in dets.items()}
    cen = paleta_ref(Lr, fig)
    cr, cm = clasificar(Lr, cen), clasificar(Lm, cen)
    ious = []
    for i in range(len(cen)):
        a, b = (cr == i) & union, (cm == i) & union
        if a.sum() > 200:
            ious.append((a & b).sum() / max(1, (a | b).sum()))
    out['iou_color'] = float(np.mean(ious))
    out['nodos'] = contar_nodos(svg)
    out['kb'] = round(len(svg.encode()) / 1024, 1)
    # rugosidad: longitud de bordes entre clases del render, a 2x, relativa a la de la referencia
    m2 = render(svg, w, h, c['fondo'], 2)
    cm2 = clasificar(lab(m2), cen)
    bm = (np.diff(cm2, axis=0) != 0).sum() + (np.diff(cm2, axis=1) != 0).sum()
    out['borde_px'] = int(bm / 2)
    # rendijas: píxeles con color de fondo dentro de la silueta del render (huecos entre capas), a 2x
    bgL = lab(np.array([[[int(c['fondo'][i:i + 2], 16) for i in (0, 2, 4)]]]))[0, 0]
    L2 = lab(m2)
    esbg = np.sqrt(((L2 - bgL) ** 2).sum(-1)) < 4
    sil = ndi.binary_fill_holes(~esbg)
    sil = ndi.binary_erosion(sil, iterations=3)
    rend = esbg & sil
    # se descartan huecos grandes legítimos (p. ej. el espacio entre piernas tiene el color del fondo)
    cc, n = ndi.label(rend)
    sizes = ndi.sum(rend, cc, range(1, n + 1)) if n else np.array([])
    out['rendijas'] = int(sizes[sizes < 400].sum()) if n else 0
    # espigas/motas: islas de color diminutas en el render (a 2x)
    motas = 0
    for i in range(len(cen)):
        cc, n = ndi.label((cm2 == i) & ~esbg)
        if n:
            s = ndi.sum(np.ones_like(cc), cc, range(1, n + 1))
            motas += int((s < 12).sum())
    out['motas'] = motas
    return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in out.items()}, ref, mine


def comparativa(ref, mine, caso, png, zoom=3):
    """Lado a lado completo + filas de zoom de cada zona de detalle (referencia | SVG)."""
    c = CASOS[caso]
    h, w = ref.shape[:2]
    filas = [np.hstack([ref, np.full((h, 8, 3), 255, np.uint8), mine])]
    for k, (x0, y0, x1, y1) in c['detalle'].items():
        a = cv2.resize(ref[y0:y1, x0:x1], None, fx=zoom, fy=zoom, interpolation=cv2.INTER_NEAREST)
        b = cv2.resize(mine[y0:y1, x0:x1], None, fx=zoom, fy=zoom, interpolation=cv2.INTER_NEAREST)
        filas.append(np.hstack([a, np.full((a.shape[0], 8, 3), 255, np.uint8), b]))
    W = max(f.shape[1] for f in filas)
    filas = [np.pad(f, ((0, 8), (0, W - f.shape[1]), (0, 0)), constant_values=255) for f in filas]
    Image.fromarray(np.vstack(filas)).save(png)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('svg')
    ap.add_argument('--caso', required=True)
    ap.add_argument('--png')
    a = ap.parse_args()
    m, ref, mine = metricas(a.svg, a.caso)
    print(json.dumps(m))
    if a.png:
        comparativa(ref, mine, a.caso, a.png)


if __name__ == '__main__':
    sys.exit(main())
