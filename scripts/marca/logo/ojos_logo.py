"""Ojos del logo medidos en la referencia: esclera con la forma real (los cachetes la aplanan abajo),
iris y brillo recortados a la esclera. Escribe los retoques 'forma' en personajes/ceti-logo.json."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from skimage import measure

RAIZ = '/home/juan/Desktop/Me/ceti'
P = RAIZ + '/scripts/marca/vectorizar/personajes/ceti-logo.json'
ref = np.array(Image.open(RAIZ + '/assets/brand/bocetos/ceti-logo-01-propuestas.png').convert('RGB')
               .crop((368, 112, 656, 400))).astype(int)
R, G, B = ref[..., 0], ref[..., 1], ref[..., 2]
piel = (R > 215) & (G > 80) & (G < 140) & (B < 70)
K = 8  # sobremuestreo

def mascara_ojo(x0, y0, x1, y1):
    m = ~piel[y0:y1, x0:x1]
    lab, n = nd.label(m)
    tam = nd.sum(m, lab, range(1, n + 1))
    m = lab == (1 + int(np.argmax(tam)))
    m = nd.binary_fill_holes(m)
    big = np.kron(m.astype(float), np.ones((K, K)))
    big = nd.gaussian_filter(big, sigma=1.6 * K)
    return big > 0.5

def contorno(mask, x0, y0, paso=3):
    c = max(measure.find_contours(mask.astype(float), 0.5), key=len)
    c = measure.approximate_polygon(c, tolerance=0.35 * K)
    return [[round(x0 + (p[1] + 0.5) / K - 0.5, 2), round(y0 + (p[0] + 0.5) / K - 0.5, 2)] for p in c[:-1]]

def circulo(shape, x0, y0, cx, cy, r):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    X = x0 + (xx + 0.5) / K - 0.5
    Y = y0 + (yy + 0.5) / K - 0.5
    return (X - cx) ** 2 + (Y - cy) ** 2 <= r * r

ojos = {
    'izq': dict(caja=(70, 146, 114, 190), iris=(96, 171.5, 11), brillo=(89.5, 163.5, 5), esclera=(91.4, 167.0, 14.9, 14.5), tope=183.6),
    'der': dict(caja=(184, 146, 228, 190), iris=(205, 171, 11.5), brillo=(198.5, 164.5, 5), esclera=(206.5, 169.0, 16.0, 15.5), tope=183.6),
}
c = json.load(open(P))
r = [x for x in c['retoques'] if not any(t in x.get('nota', '') for t in
     ('esclera ', 'iris izq', 'iris der', 'brillo izq', 'brillo der', 'ojo medido'))]
for lado, o in ojos.items():
    x0, y0, x1, y1 = o['caja']
    # esclera con la forma medida en la referencia (el cachete la aplana abajo), sin el bulto bajo el iris
    esc = mascara_ojo(x0, y0, x1, y1)
    esc[int((o['tope'] - y0 + 0.5) * K):] = False
    esc = nd.gaussian_filter(esc.astype(float), 1.2 * K) > 0.5
    iris = esc & circulo(esc.shape, x0, y0, *o['iris'])
    bri = esc & circulo(esc.shape, x0, y0, *o['brillo'])
    for nombre, m, color in (('esclera', esc, '#FFFFFF'), ('iris', iris, '#842F28'), ('brillo', bri, '#FFFFFF')):
        pts = contorno(m, x0, y0)
        r.append({'op': 'forma', 'puntos': pts, 'color': color, 'suave': True,
                  'nota': f'{nombre} {lado} ojo medido (cachete aplana abajo)'})
        print(lado, nombre, len(pts))
c['retoques'] = r
json.dump(c, open(P, 'w'), ensure_ascii=False, indent=2)
