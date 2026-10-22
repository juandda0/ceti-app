import numpy as np, sys
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure, morphology
import cairosvg
SRC = '/home/juan/Desktop/Me/ceti/assets/brand/bocetos/tato-03-hoja-modelo.jpg'
BOX = (100, 30, 620, 820)
im = np.asarray(Image.open(SRC).convert('RGB').crop(BOX)).astype(float)
H, W = im.shape[:2]
P = {  # clase: color de referencia
 'bg':'FBEFDB','floor':'E2BA93','suit':'FDE6C2','glove':'E5C3A1','line':'BB8A6A','teal':'6DB2AB','tealdk':'408D8C',
 'skin':'B9724F','skindk':'94503D','hair':'232121','maroon':'742F36','orange':'EE8329','blush':'E68364','white':'F7F1EE'}
names = list(P); cols = np.array([[int(P[n][i:i+2],16) for i in (0,2,4)] for n in names], float)
im = ndi.median_filter(im, size=(3, 3, 1))
lab = ((im[:,:,None,:]-cols[None,None])**2).sum(-1).argmin(-1)
# filtro de mayoría 5x5: quita el ruido del antialias
votes = np.stack([ndi.uniform_filter((lab == i).astype(float), 5) for i in range(len(names))], -1)
lab = votes.argmax(-1)
L = {n: lab == i for i, n in enumerate(names)}
# Fondo = lo que se alcanza desde el borde de la imagen pasando solo por fondo/piso (las líneas lo bloquean).
open_bg = L['bg'] | L['floor']
cc, n = ndi.label(open_bg)
border = set(np.unique(np.r_[cc[0], cc[-1], cc[:, 0], cc[:, -1]])) - {0}
outside = np.isin(cc, list(border))
fig = ~outside
fig = ndi.binary_opening(fig, iterations=1)
cc, n = ndi.label(fig); sizes = ndi.sum(fig, cc, range(1, n+1)); fig = cc == (np.argmax(sizes)+1)
# Bolsillos de fondo grandes y cerrados (entre las piernas/botas) siguen siendo fondo.
pocket = L['bg'] & fig
cc, n = ndi.label(pocket)
for i in range(1, n+1):
    m = cc == i
    if m.sum() > 400: fig &= ~ndi.binary_dilation(m, iterations=1)
fig = ndi.binary_opening(fig, iterations=1)
# Dentro de la figura, el crema que se confunde con el fondo es traje.
L['suit'] = L['suit'] | (L['bg'] & fig)
# --- línea marrón -> borde en tono más oscuro del relleno vecino ---
EDGE = {'suit':'E2BC92','glove':'C9A27F','teal':'408D8C','tealdk':'357A79','skin':'94503D','skindk':'94503D','hair':'232121','orange':'C9641A','white':'D9C4B8','maroon':'742F36','blush':'C9604A'}
FILL = {'suit':'FDE6C2','glove':'E5C3A1','teal':'6DB2AB','tealdk':'408D8C','skin':'B9724F','skindk':'94503D','hair':'232121','maroon':'742F36','orange':'EE8329','blush':'E68364','white':'F7F1EE'}
fills = [n for n in FILL]
fillmask = np.zeros((H, W), bool); idmap = np.full((H, W), -1)
for i, n in enumerate(fills):
    m = L[n] & fig; fillmask |= m; idmap[m] = i
_, (iy, ix) = ndi.distance_transform_edt(~fillmask, return_indices=True)
nearest = idmap[iy, ix]
out = np.full((H, W), '', object)
for i, n in enumerate(fills): out[(idmap == i)] = FILL[n]
line = fig & (L['line'] | L['floor'])  # dentro de la figura: líneas y antialias
for i, n in enumerate(fills): out[line & (nearest == i)] = EDGE[n]
out[~fig] = ''
# --- vectorizar el mosaico por color ---
def catmull(pts):
    k = len(pts); f = lambda v: f'{v:.1f}'
    d = [f'M{f(pts[0][0])} {f(pts[0][1])}']
    for i in range(k):
        p0, p1, p2, p3 = pts[i-1], pts[i], pts[(i+1)%k], pts[(i+2)%k]
        c1 = (p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6); c2 = (p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        d.append(f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}')
    return ' '.join(d) + ' Z'
def path(m, tol=0.5, sigma=1.4, min_len=10):
    m = np.pad(m, 2); res = []
    for c in measure.find_contours(m.astype(float), 0.5):
        if len(c) < min_len: continue
        c = c - 2
        c = np.stack([ndi.gaussian_filter1d(c[:,0], sigma, mode='wrap'), ndi.gaussian_filter1d(c[:,1], sigma, mode='wrap')], 1)
        p = measure.approximate_polygon(c, tol)
        if (p[0] == p[-1]).all(): p = p[:-1]
        if len(p) >= 3: res.append(catmull([(x, y) for y, x in p]))
    return ' '.join(res)
order = ['E2BC92','FDE6C2','C9A27F','E5C3A1','357A79','408D8C','6DB2AB','94503D','B9724F','C9604A','E68364','C9641A','EE8329','D9C4B8','F7F1EE','742F36','232121']
parts = []
# base: silueta completa en el tono de borde del traje (tapa huecos entre regiones)
parts.append(f'<path d="{path(fig, 0.5, 2.5)}" fill="#E2BC92"/>')
for col in order:
    m = out == col
    if col == 'E2BC92': continue
    m = ndi.binary_closing(m, iterations=1) & fig
    d = path(m, 0.4, 1.2 if col in ('742F36','F7F1EE','E68364','94503D') else 2.4, 8)
    if d: parts.append(f'<path d="{d}" fill="#{col}" fill-rule="evenodd"/>')
# --- ojos estilo Ceti: esclera, pupila y brillo como círculos ajustados ---
from skimage import measure as _m
def fit_circle(xy):
    x, y = xy[:,0], xy[:,1]; A = np.c_[2*x, 2*y, np.ones(len(x))]; b = x**2 + y**2
    cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]; return cx, cy, np.sqrt(c + cx**2 + cy**2)
face_zone = np.zeros((H, W), bool); face_zone[120:230, 150:330] = True
whites = L['white'] & face_zone
eyes = []
cc, n = ndi.label(ndi.binary_closing(whites | (L['maroon'] & face_zone & (np.arange(H)[:, None] > 150)), iterations=2))
for i in range(1, n+1):
    m = ndi.binary_fill_holes(cc == i)
    if m.sum() < 150: continue
    b = np.argwhere(m & ~ndi.binary_erosion(m))[:, ::-1].astype(float)
    ex, ey, er = fit_circle(b)
    pm = L['maroon'] & m
    pb = np.argwhere(pm & ~ndi.binary_erosion(pm))[:, ::-1].astype(float)
    px, py, pr = fit_circle(pb) if len(pb) > 8 else (ex, ey, er * 0.6)
    eyes.append((ex, ey, er, px, py, pr))
eyes.sort()
eye_svg = ''
for ex, ey, er, px, py, pr in eyes:
    er = er + 1.0; pr = min(pr + 0.6, er * 0.72)
    tx, ty, tr = px - pr * 0.42, py - pr * 0.45, pr * 0.34
    eye_svg += (f'<g><circle cx="{ex:.1f}" cy="{ey:.1f}" r="{er + 1.6:.1f}" fill="#94503D"/><circle cx="{ex:.1f}" cy="{ey:.1f}" r="{er:.1f}" fill="#FFFFFF"/>'
                f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{pr:.1f}" fill="#742F36"/><circle cx="{tx:.1f}" cy="{ty:.1f}" r="{tr:.1f}" fill="#FFFFFF"/></g>')
print('eyes', [tuple(round(v, 1) for v in e) for e in eyes])
fl = L['floor'].copy(); fl[:600] = False; fl = ndi.binary_opening(fl, iterations=4); fl &= ~ndi.binary_dilation(fig, iterations=2)
fy, fx = np.where(fl)
floor = f'<ellipse cx="{(fx.min()+fx.max())/2:.1f}" cy="{(fy.min()+fy.max())/2:.1f}" rx="{(fx.max()-fx.min())/2:.1f}" ry="{(fy.max()-fy.min())/2:.1f}" fill="#E2BA93"/>'
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">{floor}' + ''.join(parts) + eye_svg + '</svg>'
open('tato-trace.svg', 'w').write(svg)
cairosvg.svg2png(bytestring=svg.encode(), write_to='tato-trace.png', output_width=W, background_color='#FBEFDB')
ref = Image.open('front.png').convert('RGB'); mine = Image.open('tato-trace.png').convert('RGB')
s = Image.new('RGB', (W*2+10, H), 'white'); s.paste(ref, (0, 0)); s.paste(mine, (W+10, 0)); s.save('compare.png')
print(len(svg)//1024, 'KB')
